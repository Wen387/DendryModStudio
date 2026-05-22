#!/usr/bin/env node
'use strict';
const deckPools = require('./authoring/deck_pool_model.js');
const {buildDynamicRepoSemanticFixture} = require('./fixtures/dynamicrepo_semantic_fixture.js');
function fail(message){ process.stderr.write('FAIL: '+message+'\n'); process.exit(1); }
function assert(condition,message){ if(!condition) fail(message); }
const index = buildDynamicRepoSemanticFixture();
const model = deckPools.buildDeckPoolModel(index);
const party = model.deckPools.find((pool) => pool.id === 'main.party');
const govt = model.deckPools.find((pool) => pool.id === 'main.govt');
assert(party, 'main.party should be recognized as a deck pool');
assert(govt, 'main.govt should be recognized as a deck pool');
assert(party.memberCardIds.includes('shuffle_leadership'), 'Shuffle Leadership should belong to Party Affairs');
assert(!govt.memberCardIds.includes('shuffle_leadership'), 'Shuffle Leadership should not belong to Government Affairs');
assert(party.sourceAnchor && party.sourceAnchor.path && party.sourceAnchor.line, 'section-owned deck pool should retain source anchor evidence');
assert(party.availableMemberCards && party.availableMemberCards.length, 'Party Affairs should expose addable member card candidates');
assert(party.targetDeckPools && party.targetDeckPools.some((pool) => pool.id === 'main.govt'), 'Party Affairs should expose Government Affairs as a move target');
const shuffle = party.memberCards.find((card) => card.cardId === 'shuffle_leadership');
assert(shuffle && shuffle.currentPoolIds.includes('main.party'), 'member rows should expose current deck pool membership');
assert(shuffle && shuffle.membershipKind === 'tag' && shuffle.membershipTag === 'party_affairs', 'member rows should expose tag membership details');
assert(shuffle && shuffle.membershipSource && shuffle.membershipSource.path, 'member rows should expose source-backed membership evidence');
const hybridIndex = Object.assign({}, index, {semantic: Object.assign({}, index.semantic, {deckPools: [{id: 'hybrid.pool', label: 'Hybrid Pool', routeTags: ['party_affairs'], directSceneIds: ['root'], routeTargets: [{kind: 'tag', id: 'party_affairs'}, {kind: 'scene', id: 'root'}]}]})});
const hybrid = deckPools.buildDeckPoolModel(hybridIndex).deckPools[0];
assert(hybrid.kind === 'hybrid' && hybrid.status === 'partial', 'hybrid deck pools should be marked partial/manual');
process.stdout.write(JSON.stringify({ok:true, deckPools:model.deckPools.length, partyMembers:party.memberCardIds.length}, null, 2)+'\n');
