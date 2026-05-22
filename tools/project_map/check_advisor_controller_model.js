#!/usr/bin/env node
'use strict';
const advisorModel = require('./authoring/advisor_controller_model.js');
const {buildDynamicRepoSemanticFixture} = require('./fixtures/dynamicrepo_semantic_fixture.js');
function fail(message){ process.stderr.write('FAIL: '+message+'\n'); process.exit(1); }
function assert(condition,message){ if(!condition) fail(message); }
const index = buildDynamicRepoSemanticFixture();
const model = advisorModel.buildAdvisorControllerModel(index);
const controller = model.advisorControllers.find((item) => item.id === 'shuffle_leadership');
assert(controller, 'Shuffle Leadership should be recognized as an advisor controller');
assert(controller.pinnedEntry && controller.pinnedEntry.id === 'shuffle_leadership_pinned', 'controller should link the pinned entry');
const siemsen = controller.roster.find((item) => item.advisorId === 'siemsen');
assert(siemsen && siemsen.activeVariable === 'siemsen_advisor', 'roster should link advisor active variable');
assert(siemsen.sourceAnchors.addEffect && siemsen.sourceAnchors.addEffect.path, 'advisor add effect source should be traceable');
assert(siemsen.sourceAnchors.tags && siemsen.sourceAnchors.tags.path, 'advisor category/faction tags should be traceable');
const partialIndex = Object.assign({}, index, {scenes: index.scenes.map((scene) => scene.id === 'shuffle_leadership' ? Object.assign({}, scene, {
  sections: scene.sections.filter((section) => section.id !== 'shuffle_leadership.remove_siemsen')
}) : scene)});
const partial = advisorModel.buildAdvisorControllerModel(partialIndex).advisorControllers.find((item) => item.id === 'shuffle_leadership');
assert(partial && partial.confidence !== 'exact', 'incomplete add/remove variable pattern should become partial/manual');
process.stdout.write(JSON.stringify({ok:true, roster:controller.roster.length, confidence:controller.confidence}, null, 2)+'\n');
