#!/usr/bin/env node
// @ts-check
'use strict';

const assetContracts = require('./authoring/asset_contract_model.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

const eventSlots = assetContracts.assetSlotDefinitions('event');
const cardSlots = assetContracts.assetSlotDefinitions('card');
assert(eventSlots.some((slot) => slot.role === 'event_illustration' && slot.roleLabel === 'Event illustration'), 'event slots should expose role labels', eventSlots);
assert(eventSlots.some((slot) => slot.role === 'event_audio' && slot.type === 'audio'), 'event slots should include audio');
assert(cardSlots.some((slot) => slot.role === 'card_image' && slot.type === 'image'), 'card slots should include card images');
assert(assetContracts.normalizeTarget('advisor_like') === 'card', 'advisor-like assets should use card slots');
assert(assetContracts.normalizeTarget('world_event') === 'event', 'unknown targets should default to event slots');

assert(assetContracts.normalizeAssetDirective(' FACE-IMAGE ') === 'face-image', 'directives should normalize case and whitespace');
assert(assetContracts.normalizeAssetDirective('bad-directive') === '', 'unknown directives should be rejected');
assert(assetContracts.roleForAssetDirective('face-image', 'event') === 'event_portrait', 'event face-image should map to portrait');
assert(assetContracts.roleForAssetDirective('face-image', 'card') === 'card_portrait', 'card face-image should map to portrait');
assert(assetContracts.roleForAssetDirective('set-bg', 'event') === 'event_background', 'event set-bg should map to background');
assert(assetContracts.roleForAssetDirective('audio', 'card') === 'card_audio', 'card audio should map to audio slot');
assert(assetContracts.assetRoleLabel('card_background') === 'Card background', 'known roles should render stable labels');
assert(assetContracts.assetRoleLabel('custom_role') === 'Custom Role', 'unknown roles should humanize');

assert(assetContracts.normalizeAssetPlacementKind('option_result_visual') === 'option_result_visual', 'known placements should be preserved');
assert(assetContracts.normalizeAssetPlacementKind('surprise') === 'unknown_inline', 'unknown placements should normalize to review-first inline placement');
assert(assetContracts.isFlowPlacementKind('option_result_visual'), 'option result visual should be a flow asset');
assert(!assetContracts.isFlowPlacementKind('global_slot'), 'global slot should not be a flow asset');

assert(assetContracts.assetTypeForExtension('.JPG') === 'image', 'image extension should classify as image');
assert(assetContracts.assetTypeForExtension('.ogg') === 'audio', 'audio extension should classify as audio');
assert(assetContracts.extensionForPath('img/hero.png?cache=1') === '.png', 'extensions should ignore URL suffixes');
assert(assetContracts.safeAssetFileName('Portrait Hero.PNG', 'image') === 'portrait-hero.png', 'asset filenames should be stable and lowercase');
assert(assetContracts.safeAssetFileName('No Extension', 'audio') === 'no-extension.ogg', 'audio install targets should get default extension');
assert(
  assetContracts.suggestAssetTargetPath({name: 'Portrait Hero.PNG', type: 'image'}, {target: 'event', draftId: 'asset_preview_event'}) === 'assets/studio/events/asset_preview_event/portrait-hero.png',
  'event asset target paths should match Object Canvas install convention'
);
assert(
  assetContracts.suggestAssetTargetPath({name: 'Card Art', type: 'image'}, {target: 'card', draftId: 'media_card'}) === 'assets/studio/cards/media_card/card-art.png',
  'card asset target paths should match Object Canvas install convention'
);

const request = assetContracts.assetInstallRequest({
  sourceName: 'Hero Local.PNG',
  sourcePath: '/tmp/Hero Local.PNG',
  targetPath: 'assets/studio/events/hero/hero-local.png',
  type: 'image',
  role: 'event_illustration',
  placementKind: 'option_result_visual',
  relatedOptionIds: ['support_labor', 42]
});
assert(request.status === 'ready_for_review', 'source-backed install requests should be ready for review', request);
assert(request.roleLabel === 'Event illustration', 'install requests should expose role labels', request);
assert(request.placementKind === 'option_result_visual', 'install requests should preserve placement kind', request);
assert(request.relatedOptionIds.length === 2 && request.relatedOptionIds[1] === '42', 'install requests should normalize related option ids', request);

const missingSource = assetContracts.assetInstallRequest({targetPath: 'assets/studio/events/hero/missing.png', type: 'image'}, {role: 'event_illustration'});
assert(missingSource.status === 'needs_source_file', 'install requests without local source should stay explicit', missingSource);
assert(missingSource.role === 'event_illustration', 'install request options should provide role fallback', missingSource);

process.stdout.write(JSON.stringify({
  ok: true,
  eventSlots: eventSlots.length,
  cardSlots: cardSlots.length,
  requestStatus: request.status,
  missingSourceStatus: missingSource.status
}, null, 2) + '\n');
