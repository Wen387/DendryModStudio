#!/usr/bin/env node
'use strict';

const assetHelpersModule = require('./authoring/existing_scene_asset_helpers.js');
const conditionDiagnostics = require('./authoring/existing_scene_condition_diagnostics.js');
const textBlockHelpersModule = require('./authoring/existing_scene_text_block_helpers.js');
const textBlockBuilderModule = require('./authoring/existing_scene_text_block_builder.js');
const {fail, assert} = require('./check_harness.js');

function helperSourceRef(source) {
  const value = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const line = Number(value.line || value.startLine || 0) || null;
  const endLine = Number(value.endLine || value.line || value.startLine || 0) || null;
  return {
    path: String(value.path || '').trim(),
    line,
    startLine: line,
    endLine,
    anchorText: String(value.anchorText || '').trim(),
    endAnchorText: String(value.endAnchorText || '').trim()
  };
}

const assetHelpers = assetHelpersModule.create({
  sourceRef: helperSourceRef,
  canGuardField(source, original) {
    return Boolean(source && source.path && source.line && String(original || '').trim());
  },
  safeId(value) {
    return String(value || 'field').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
  }
});
const textBlockHelpers = textBlockHelpersModule.create({
  sourceRef: helperSourceRef,
  humanSectionId(value) {
    return 'Label ' + String(value || '');
  }
});
const textBlockBuilder = textBlockBuilderModule.create({
  sourceRef: helperSourceRef,
  sourceLine(source) {
    return helperSourceRef(source).line || 0;
  },
  safeId(value) {
    const text = String(value || 'field').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    return /^[A-Za-z_]/.test(text) ? text : 'field_' + text;
  },
  isProtectedRouterPath(relPath) {
    return String(relPath || '').replace(/\\/g, '/') === 'source/scenes/root.scene.dry';
  },
  textBlockHelpers
});

const alternatives = textBlockHelpers.conditionalAlternativesForRows([
  {role: 'conditional_body', conditions: ['Q.flag'], text: 'Same line text', source: {path: 'source/scenes/demo.scene.dry', line: 12}},
  {role: 'conditional_body', conditions: ['Q.flag'], text: 'Same line text', source: {path: 'source/scenes/demo.scene.dry', line: 13}},
  {role: 'conditional_body', conditions: ['Q.flag'], text: 'Same line text', source: {path: 'source/scenes/demo.scene.dry', line: 13}}
]);
assert(alternatives.length === 2, 'text block helper should dedupe conditional alternatives by condition/text/source path/source line');
assert(alternatives.every((item) => item.condition === 'Q.flag' && item.text === 'Same line text' && item.source.path && item.source.line), 'conditional alternatives should keep condition, text, and injected sourceRef shape');

const flatTree = textBlockHelpers.extractInlineConditionalTree('Base text [? if Q.a : Alpha ?] tail');
assert(flatTree.length === 1, 'tree parser should find a single top-level conditional');
assert(flatTree[0].condition === 'Q.a' && flatTree[0].text === 'Alpha' && flatTree[0].children.length === 0, 'depth-1 conditional should expose condition/text and no children');

const nestedTree = textBlockHelpers.extractInlineConditionalTree('Lead [? if Q.a : Alpha [? if Q.b : Beta ?] ?]');
assert(nestedTree.length === 1 && nestedTree[0].condition === 'Q.a', 'depth-2 parser should keep the outer branch at the top level');
assert(nestedTree[0].text === 'Alpha', 'depth-2 outer branch should report only its own directly-visible text');
assert(nestedTree[0].children.length === 1 && nestedTree[0].children[0].condition === 'Q.b' && nestedTree[0].children[0].text === 'Beta', 'depth-2 parser should nest the inner branch under its parent');

const deepTree = textBlockHelpers.extractInlineConditionalTree('[? if Q.a : A [? if Q.b : B [? if Q.c : C ?] ?] ?]');
assert(deepTree[0].children[0].children[0].condition === 'Q.c' && deepTree[0].children[0].children[0].text === 'C', 'depth-3 nesting should be preserved end to end');

const siblingTree = textBlockHelpers.extractInlineConditionalTree('[? if Q.a : A ?] middle [? if Q.b : B ?]');
assert(siblingTree.length === 2 && siblingTree[0].condition === 'Q.a' && siblingTree[1].condition === 'Q.b', 'adjacent conditionals should become sibling top-level nodes');

const malformedTree = textBlockHelpers.extractInlineConditionalTree('[? if Q.a : unterminated body without close');
assert(Array.isArray(malformedTree) && malformedTree.length === 0, 'unbalanced conditional should yield no branches and must not throw');
assert(textBlockHelpers.extractInlineConditionalTree('plain prose with no conditionals').length === 0, 'plain prose should produce an empty tree');

// --- Position-preserving span parser + byte-exact leaf splice (P3a) ---
function spanLeaves(nodes, acc) {
  acc = acc || [];
  (nodes || []).forEach((node) => {
    if (node.children && node.children.length) spanLeaves(node.children, acc);
    else acc.push(node);
  });
  return acc;
}

const spanLine = 'Base text [? if Q.a : Alpha ?] tail';
const spanTree = textBlockHelpers.extractInlineConditionalTreeWithSpans(spanLine);
assert(spanTree.length === 1 && spanTree[0].rawCondition === 'Q.a' && spanTree[0].rawText === 'Alpha', 'span parser should record verbatim condition/text for a depth-1 leaf');
assert(spanLine.slice(spanTree[0].condStart, spanTree[0].condEnd) === 'Q.a', 'condStart/condEnd should bracket the verbatim condition');
assert(spanLine.slice(spanTree[0].textStart, spanTree[0].textEnd) === 'Alpha', 'textStart/textEnd should bracket the verbatim own-text');
assert(spanLine.slice(spanTree[0].spanStart, spanTree[0].spanEnd) === '[? if Q.a : Alpha ?]', 'spanStart/spanEnd should bracket the whole [? ?] span');

// Identity: splicing a leaf with its own current values reproduces the line byte-for-byte.
const spanCorpus = [
  spanLine,
  '[? if Q.a : A ?] middle [? if Q.b : B ?]',
  '[? if act = 1 and year <= 1933 : First ?][? if act = 2 : Second ?]',
  '[? if a = 1 : outer [? if b = 2 : inner ?] tail ?]',
  '[? if p : one [? if q : two [? if r : three ?] ?] ?]',
  '[? if  spaced  :  padded text  ?]'
];
spanCorpus.forEach((line) => {
  spanLeaves(textBlockHelpers.extractInlineConditionalTreeWithSpans(line)).forEach((leaf) => {
    assert(textBlockHelpers.spliceInlineLeaf(line, leaf, {condition: leaf.rawCondition, text: leaf.rawText}) === line, 'identity splice should reproduce the source line byte-for-byte: ' + JSON.stringify(line));
  });
});

// Isolation: editing one leaf changes only its own region; siblings + nested branches stay intact and re-parse cleanly.
const isoLine = '[? if Q.a : A ?] middle [? if Q.b : B ?]';
const isoLeaves = spanLeaves(textBlockHelpers.extractInlineConditionalTreeWithSpans(isoLine));
const isoEdited = textBlockHelpers.spliceInlineLeaf(isoLine, isoLeaves[0], {text: 'EDITED'});
assert(isoEdited === '[? if Q.a : EDITED ?] middle [? if Q.b : B ?]', 'editing one sibling leaf must leave every other byte (delimiters, prose, sibling) identical');
const isoReparsed = spanLeaves(textBlockHelpers.extractInlineConditionalTreeWithSpans(isoEdited));
assert(isoReparsed.length === 2 && isoReparsed[0].rawText === 'EDITED' && isoReparsed[1].rawText === 'B', 're-parse after a leaf edit should read back the edit and keep siblings unchanged');

// Condition edit isolation.
const condEdited = textBlockHelpers.spliceInlineLeaf(isoLine, isoLeaves[1], {condition: 'Q.zz >= 3'});
assert(condEdited === '[? if Q.a : A ?] middle [? if Q.zz >= 3 : B ?]', 'editing a leaf condition must splice only the condition range');

// Nested-leaf edit leaves the parent own-text and delimiters intact.
const nestLine = '[? if a = 1 : outer [? if b = 2 : inner ?] tail ?]';
const nestLeaves = spanLeaves(textBlockHelpers.extractInlineConditionalTreeWithSpans(nestLine));
const innerLeaf = nestLeaves.find((leaf) => leaf.rawText === 'inner');
assert(textBlockHelpers.spliceInlineLeaf(nestLine, innerLeaf, {text: 'NEW'}) === '[? if a = 1 : outer [? if b = 2 : NEW ?] tail ?]', 'editing a nested leaf must preserve the parent own-text and surrounding delimiters');

// Input-validation gate: values that would corrupt the grammar must be rejected.
assert(textBlockHelpers.isEditableInlineLeafValue('plain prose', 'text') === true, 'plain text should be editable');
assert(textBlockHelpers.isEditableInlineLeafValue('contains [? if x', 'text') === false, 'text carrying an opening [? delimiter must be rejected');
assert(textBlockHelpers.isEditableInlineLeafValue('contains ?] close', 'text') === false, 'text carrying a closing ?] delimiter must be rejected');
assert(textBlockHelpers.isEditableInlineLeafValue('Q.a >= 1', 'condition') === true, 'a clean predicate should be an editable condition');
assert(textBlockHelpers.isEditableInlineLeafValue('Q.a : 1', 'condition') === false, 'a condition carrying a colon body separator must be rejected');
assert(textBlockHelpers.isEditableInlineLeafValue('', 'condition') === false, 'an empty condition must be rejected');

// conditionalTreeForRows enrichment (P3a Pillar B): inline leaves carry the
// verbatim line + splice span + an editable flag; parents with children and
// the source-uniqueness guard stay non-editable for leaf-only P3a editing.
const enrichLine = 'Base [? if Q.a : Alpha ?] mid [? if Q.b : Beta [? if Q.c : Gamma ?] ?]';
const enrichTree = textBlockHelpers.conditionalTreeForRows([
  {role: 'body', hasInlineConditionals: true, text: enrichLine, originalText: enrichLine, source: {path: 'source/scenes/x.scene.dry', line: 7, anchorText: enrichLine}}
]);
const enrichLeaves = spanLeaves(enrichTree);
const alphaNode = enrichLeaves.find((node) => node.rawText === 'Alpha');
assert(alphaNode && alphaNode.editable === true && alphaNode.lineText === enrichLine, 'a depth-1 inline leaf should be editable and carry the verbatim source line');
assert(enrichLine.slice(alphaNode.span.textStart, alphaNode.span.textEnd) === 'Alpha', 'the carried span should index the verbatim own-text within lineText');
assert(textBlockHelpers.spliceInlineLeaf(alphaNode.lineText, {textStart: alphaNode.span.textStart, textEnd: alphaNode.span.textEnd, condStart: alphaNode.span.condStart, condEnd: alphaNode.span.condEnd}, {text: 'EDITED'}) === 'Base [? if Q.a : EDITED ?] mid [? if Q.b : Beta [? if Q.c : Gamma ?] ?]', 'editing via the carried span must leave siblings and nested branches byte-identical');
const gammaNode = enrichLeaves.find((node) => node.rawText === 'Gamma');
assert(gammaNode && gammaNode.editable === true, 'a nested leaf should still be editable');
const betaNode = enrichTree.find((node) => node.condition === 'Q.b');
assert(betaNode && betaNode.editable === false, 'a parent branch with children must not be editable under leaf-only P3a editing');
const unbalancedTree = textBlockHelpers.conditionalTreeForRows([
  {role: 'body', hasInlineConditionals: true, text: '[? if Q.a : Alpha', originalText: '[? if Q.a : Alpha', source: {path: 'source/scenes/x.scene.dry', line: 8, anchorText: '[? if Q.a : Alpha [? if Q.b : Beta ?]'}}
]);
assert(spanLeaves(unbalancedTree).every((node) => node.editable !== true), 'leaves on an unbalanced line must not be marked editable');

const ownedOption = {id: '@owned', sectionId: 'demo.menu', targetId: 'elsewhere'};
const incomingOption = {id: '@incoming', sectionId: 'demo.start', targetId: '@menu'};
assert(!textBlockHelpers.sectionTargetedByOption('demo', 'demo.menu', ownedOption), 'owned choices must not count as incoming targeted options');
assert(textBlockHelpers.sectionOwnsOption('demo', 'demo.menu', ownedOption), 'sectionOwnsOption should match option section ownership');
assert(textBlockHelpers.sectionTargetedByOption('demo', 'menu', incomingOption), 'sectionTargetedByOption should match incoming option result targets');
assert(!textBlockHelpers.sectionOwnsOption('demo', 'menu', incomingOption), 'incoming result targets must not count as owned choices');

const visualKinds = textBlockHelpers.detectVisualKinds('<table><tr><td>Votes</td></tr></table><div>chart</div> ![Poster](img/cards/poster.png) assets/gallery/card.webp');
assert(visualKinds.includes('chart') && visualKinds.includes('html') && visualKinds.includes('asset'), 'visual kind helper should detect table/html chart and markdown/path image assets');
assert(textBlockHelpers.detectVisualKinds('img/cards/plain.jpg').includes('asset'), 'visual kind helper should detect plain image path assets');
assert(textBlockHelpers.isMixedInlineConditionalSource('The room shifts [? if Q.flag: toward applause ?] after the vote.'), 'mixed inline conditional prose should be recognized');
assert(!textBlockHelpers.isMixedInlineConditionalSource('# branch [? if Q.flag: hidden ?]'), 'pure structural inline conditional lines should not be mixed prose');

const renderedBlock = textBlockBuilder.renderTextBlockContent([
  {role: 'heading', text: 'Scene Heading', source: {path: 'source/scenes/demo.scene.dry', line: 4}},
  {role: 'conditional_body', conditions: ['Q.flag'], text: 'Flag text', source: {path: 'source/scenes/demo.scene.dry', line: 5, anchorText: '[? if Q.flag: Flag text ?]'}},
  {role: 'conditional_body', conditions: ['Q.flag'], text: 'Flag text', source: {path: 'source/scenes/demo.scene.dry', line: 5, anchorText: '[? if Q.flag: Flag text ?]'}},
  {
    role: 'body',
    text: 'Center Party',
    hasInlineConditionals: true,
    source: {
      path: 'source/scenes/demo.scene.dry',
      line: 6,
      anchorText: 'The room shifts [? if Q.flag: toward applause ?] after the vote.'
    }
  }
]);
assert(renderedBlock.includes('= Scene Heading'), 'text block builder should add Dendry heading marker when rendering headings');
assert(renderedBlock.indexOf('[? if Q.flag: Flag text ?]') === renderedBlock.lastIndexOf('[? if Q.flag: Flag text ?]'), 'text block builder should dedupe duplicate conditional rows from the same source line');
assert(renderedBlock.includes('The room shifts [? if Q.flag: toward applause ?] after the vote.'), 'text block builder should preserve mixed inline conditional source anchors');

const blockScene = {id: 'demo', title: 'Demo', path: 'source/scenes/demo.scene.dry', sections: []};
const protectedBlocks = textBlockBuilder.textBlocksForScene(blockScene, [
  {id: 'protected_body', role: 'body', text: 'Protected opening.', owner: {sceneId: 'demo', sectionId: ''}, source: {path: 'source/scenes/root.scene.dry', line: 2}}
], 'source/scenes/root.scene.dry', []);
assert(protectedBlocks.length === 0, 'text block builder should not return guarded blocks for protected router paths');

const sharedLineBlocks = textBlockBuilder.textBlocksForScene(blockScene, [
  {id: 'shared_prose', role: 'body', text: 'Shared prose.', owner: {sceneId: 'demo', sectionId: ''}, source: {path: 'source/scenes/demo.scene.dry', line: 8, anchorText: 'Shared prose.'}},
  {id: 'shared_condition', role: 'conditional_body', conditions: ['Q.flag'], text: 'Shared conditional.', owner: {sceneId: 'demo', sectionId: ''}, source: {path: 'source/scenes/demo.scene.dry', line: 8, anchorText: '[? if Q.flag: Shared conditional. ?]'}}
], 'source/scenes/demo.scene.dry', []);
assert(sharedLineBlocks.length === 2, 'text block builder should keep shared source line prose and conditional split into separate runs');
assert(sharedLineBlocks.every((block) => block.editability === 'advanced_source_patch'), 'shared source line split runs should use advanced source patch safety');

const spanBlocks = textBlockBuilder.textBlocksForScene(blockScene, [
  {
    id: 'span_body_1',
    role: 'body',
    text: 'First span line.',
    owner: {sceneId: 'demo', sectionId: ''},
    source: {path: 'source/scenes/demo.scene.dry', line: 12, endLine: 12, anchorText: 'First span line.', endAnchorText: 'First span line.'}
  },
  {
    id: 'span_body_2',
    role: 'body',
    text: 'Second span line.',
    owner: {sceneId: 'demo', sectionId: ''},
    source: {path: 'source/scenes/demo.scene.dry', line: 13, endLine: 14, anchorText: 'Second span line.', endAnchorText: 'Second span continuation.'}
  }
], 'source/scenes/demo.scene.dry', []);
assert(spanBlocks.length === 1, 'text block builder should assemble adjacent prose rows into one source-backed block');
assert(spanBlocks[0].source.anchorText === 'First span line.', 'text block source should preserve the first source anchor');
assert(spanBlocks[0].source.endAnchorText === 'Second span continuation.', 'text block source should preserve the last source end anchor');
assert(spanBlocks[0].source.line === 12 && spanBlocks[0].source.endLine === 14, 'text block source should preserve start and end lines');

const stringAsset = assetHelpers.normalizeAssetRef('img/cards/foo.PNG');
assert(stringAsset.type === 'image', 'asset helper should classify uppercase image extensions');
assert(stringAsset.label === 'foo.PNG', 'asset helper should use filename fallback for string asset labels');

const srcAsset = assetHelpers.normalizeAssetRef({
  src: 'audio/theme.OGG',
  name: 'Theme cue',
  source: {
    path: 'source/scenes/events/cue.scene.dry',
    line: 12,
    endLine: 12,
    anchorText: 'audio: audio/theme.OGG',
    endAnchorText: 'audio: audio/theme.OGG'
  },
  fileExists: false,
  previewUrl: 'preview://theme'
});
assert(srcAsset.path === 'audio/theme.OGG', 'asset helper should use src fallback as path');
assert(srcAsset.type === 'audio', 'asset helper should classify audio extensions');
assert(srcAsset.label === 'Theme cue', 'asset helper should use name fallback as label');
assert(srcAsset.source.line === 12 && srcAsset.source.endLine === 12, 'asset helper should preserve source line and endLine through injected sourceRef');
assert(srcAsset.source.anchorText === 'audio: audio/theme.OGG' && srcAsset.source.endAnchorText === 'audio: audio/theme.OGG', 'asset helper should preserve source anchors through injected sourceRef');
assert(srcAsset.fileExists === false, 'asset helper should pass fileExists through without coercion');
assert(srcAsset.previewUrl === 'preview://theme', 'asset helper should preserve string previewUrl');

const urlAsset = assetHelpers.normalizeAssetRef({url: 'misc/readme.bin'});
assert(urlAsset.path === 'misc/readme.bin', 'asset helper should use url fallback as path');
assert(urlAsset.type === 'asset', 'asset helper should classify unknown extensions as asset');
assert(assetHelpers.assetType('sound/effect.flac') === 'audio', 'asset helper should classify flac as audio');

const requestAlias = assetHelpers.normalizeAssetInstallRequest({
  fileName: 'portrait.png',
  target: 'img/portraits/portrait.png',
  assetType: 'image',
  name: 'Portrait',
  role: ' face-image '
});
assert(requestAlias.sourceName === 'portrait.png', 'asset install request should normalize fileName alias');
assert(requestAlias.targetPath === 'img/portraits/portrait.png', 'asset install request should normalize target alias');
assert(requestAlias.type === 'image', 'asset install request should normalize assetType alias');
assert(requestAlias.label === 'Portrait', 'asset install request should use name alias for label');
assert(requestAlias.role === 'face-image', 'asset install request should trim role');

assert(conditionDiagnostics.impossibleMonthWindow('month >= 9 and month <= 2').includes('greater than upper bound'), 'condition diagnostic helper should expose impossible month window analysis');
assert(conditionDiagnostics.conditionWindowDiagnosticsForScene({
  id: 'helper_scene',
  sections: [{id: 'helper_scene.late_year', viewIf: 'month >= 9 and month <= 2'}]
}).some((diag) => diag.message.includes('Section condition: late_year')), 'condition diagnostic helper should strip scene id prefixes from section labels');
assert(conditionDiagnostics.conditionWindowDiagnosticsForChanges([{
  role: 'condition',
  label: 'Appearance condition',
  after: 'month = 3 and month == 4'
}]).some((diag) => diag.message.includes('multiple values')), 'condition diagnostic helper should warn when month has conflicting exact values');
assert(conditionDiagnostics.conditionWindowDiagnosticsForChanges([{
  role: 'condition',
  label: 'Appearance condition',
  after: 'month >= 0'
}]).some((diag) => diag.message.includes('between 1 and 12')), 'condition diagnostic helper should warn when month bounds are out of range');

process.stdout.write(JSON.stringify({
  ok: true,
  checked: [
    'existing_scene_asset_helpers',
    'existing_scene_condition_diagnostics',
    'existing_scene_text_block_helpers',
    'existing_scene_text_block_builder'
  ]
}) + '\n');
