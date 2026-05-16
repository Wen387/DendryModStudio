#!/usr/bin/env node
'use strict';

const assetHelpersModule = require('./authoring/existing_scene_asset_helpers.js');
const conditionDiagnostics = require('./authoring/existing_scene_condition_diagnostics.js');
const textBlockHelpersModule = require('./authoring/existing_scene_text_block_helpers.js');
const textBlockBuilderModule = require('./authoring/existing_scene_text_block_builder.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

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
