#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const DESKTOP_DIR = path.join(ROOT, 'desktop');
const core = require('./desktop/studio_core.js');
const canvasModel = require('./authoring/object_authoring_canvas_model.js');
const installPlan = require('./authoring/install_plan.js');
const complexAuthoring = require('./authoring/complex_event_authoring_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');
const {pythonCommand} = require('./check_python_command.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function actionFields(body, action) {
  return (body && Array.isArray(body.structureActions) ? body.structureActions : [])
    .filter((field) => String(field && field.structureAction || '') === action);
}

function hasAction(body, action, predicate) {
  const rows = actionFields(body, action);
  return rows.some((row) => typeof predicate === 'function' ? predicate(row) : true);
}

function resultStatuses(result) {
  return (result.results || []).map((row) => row.status).sort();
}

function sceneById(index, id) {
  return (index.scenes || []).find((scene) => String(scene && scene.id || '') === id) || null;
}

function hasLocalSection(scene, localId) {
  return (scene.sections || []).some((section) => String(section && section.id || '').split('.').pop() === localId);
}

function hasText(index, text) {
  const corpus = index.semantic && index.semantic.textCorpus && Array.isArray(index.semantic.textCorpus.items)
    ? index.semantic.textCorpus.items
    : [];
  return corpus.some((item) => String(item && item.text || '').includes(text));
}

function panelSegment(html, marker) {
  const start = String(html || '').indexOf(marker);
  if (start < 0) {
    return '';
  }
  const end = html.indexOf('</section>', start);
  return html.slice(start, end > start ? end : html.length);
}

function dynamicLikeDraft() {
  return {
    schemaVersion: '0.1',
    kind: 'world_event',
    id: 'demo_dynamic_crisis_1930',
    eventShape: 'choice_event',
    title: '<span style="color: #3E88B3;">**Demo Front**</span> Crisis',
    subtitle: 'A live test for complex create flows',
    heading: '<span style="color: #003755;">Crisis committee</span> convenes',
    tags: ['event', 'world', 'demo'],
    newPage: true,
    useSeenFlag: true,
    seenFlag: 'demo_dynamic_crisis_seen',
    maxVisits: 1,
    when: {
      year: 1930,
      monthStart: 2,
      monthEnd: 5,
      requires: 'demo_support >= 0 and demo_conflict >= 0',
      priority: 2
    },
    introParagraphs: [
      'A coalition committee receives contradictory telegrams from the districts while <span style="color: #3E88B3;">**organizers**</span> argue over tempo and public posture.',
      'The room is split between immediate mobilization, cabinet bargaining, and a quieter press strategy.'
    ],
    effectsOnTrigger: [
      {variable: 'demo_dynamic_pressure', op: '+=', value: 1}
    ],
    assetRefs: [
      {path: 'img/events/demo_dynamic_crisis.png', type: 'image', label: 'Committee room illustration', role: 'event_illustration'}
    ],
    options: [
      {
        id: 'hold_line',
        label: 'Hold the organizing line.',
        subtitle: '+ pressure, opens committee layer',
        chooseIf: 'demo_support >= 0',
        unavailableText: 'The organization is not ready.',
        narrativeParagraphs: ['The organizers publish a disciplined instruction sheet and wait for district replies.'],
        returnTarget: 'committee_floor',
        effects: [{variable: 'demo_dynamic_pressure', op: '+=', value: 2}]
      },
      {
        id: 'bargain',
        label: 'Bargain with the cabinet bloc.',
        narrativeParagraphs: ['The cabinet bloc asks for a quieter tone before it will trade concessions.'],
        returnTarget: 'root',
        effects: [{variable: 'demo_cabinet_balance', op: '+=', value: 1}],
        variants: [{condition: 'demo_conflict > 0', text: 'The conflict file makes the room less patient.'}]
      },
      {
        id: 'signal_committee',
        label: 'Signal the committee privately.',
        narrativeParagraphs: ['Private notes move faster than speeches, but the record becomes harder to follow.'],
        returnTarget: 'root',
        effects: [{variable: 'demo_public_attention', op: '-=', value: 1}]
      },
      {
        id: 'defer',
        label: 'Defer until the districts report.',
        narrativeParagraphs: ['The committee writes down every uncertainty and postpones a public line.'],
        returnTarget: 'root'
      }
    ],
    sections: [
      {
        id: 'committee_floor',
        title: 'Committee floor',
        condition: 'demo_dynamic_pressure >= 2',
        paragraphs: ['The second layer opens after the first choice raises pressure.'],
        effects: [{variable: 'demo_cabinet_balance', op: '+=', value: 1}],
        options: [
          {
            id: 'publish_minutes',
            label: 'Publish the minutes.',
            narrativeParagraphs: ['The minutes make the faction split visible, but they also settle the record.'],
            returnTarget: 'root',
            effects: [{variable: 'demo_public_attention', op: '+=', value: 2}]
          }
        ]
      },
      {
        id: 'press_room',
        title: 'Press room',
        paragraphs: ['This provisional layer should be removable before install.'],
        exitTarget: 'root'
      }
    ]
  };
}

async function runStarterDemoComplexEventCreate() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_starter_complex_create_'));
  const firstIndexRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_starter_complex_index_'));
  const secondIndexRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_starter_complex_reindex_'));

  try {
    const prepared = core.prepareStarterDemo({desktopDir: DESKTOP_DIR, workspaceRoot});
    assert(prepared.ok, 'starter demo should prepare a writable project copy', prepared);

    const indexed = await core.buildProjectIndex({
      root: prepared.root,
      outDir: firstIndexRoot,
      includeExcerpts: false,
      python: pythonCommand(),
      desktopDir: DESKTOP_DIR
    });
    assert(indexed.ok, 'starter demo should build before complex create', indexed.error || indexed);
    assert(indexed.index.project.profileIds.includes('generic-dendry'), 'starter demo should keep the generic-dendry profile', indexed.index.project);

    const draft = dynamicLikeDraft();
    const initialModel = canvasModel.buildNewEventCanvas(indexed.index, draft, {});
    assert(initialModel.ok, 'complex Demo draft should open in the new-event canvas', initialModel.changeState.diagnostics);
    assert(initialModel.mode === 'new_event', 'complex Demo draft should use new_event mode', initialModel.mode);
    assert(initialModel.eventBody.options.filter((option) => !option.sectionId).length === 4, 'new-event canvas should expose four root options', initialModel.eventBody.options);
    assert(initialModel.eventBody.options.some((option) => option.sectionId === 'committee_floor'), 'new-event canvas should expose section-owned options', initialModel.eventBody.options);
    assert(initialModel.eventBody.branchSections.some((field) => field.sectionId === 'committee_floor'), 'new-event canvas should expose the committee branch fields', initialModel.eventBody.branchSections);
    assert(initialModel.eventBody.branchSections.some((field) => field.sectionId === 'press_room'), 'new-event canvas should expose removable provisional branch fields', initialModel.eventBody.branchSections);
    assert(hasAction(initialModel.eventBody, 'add_option', (field) => field.id === 'structure_add_option_section_committee_floor'), 'new-event canvas should expose add-option inside a branch layer', initialModel.eventBody.structureActions);
    assert(hasAction(initialModel.eventBody, 'remove_option', (field) => field.optionId === 'publish_minutes'), 'new-event canvas should expose remove for section-owned options', initialModel.eventBody.structureActions);
    assert(hasAction(initialModel.eventBody, 'remove_layer', (field) => field.sectionId === 'press_room'), 'new-event canvas should expose remove-layer for draft branches', initialModel.eventBody.structureActions);
    assert(hasAction(initialModel.eventBody, 'remove_effect', (field) => field.optionId === 'signal_committee'), 'new-event canvas should expose remove-effect for option effects', initialModel.eventBody.structureActions);
    assert(initialModel.contextBoard.variables.some((row) => row.name === 'demo_dynamic_pressure' && row.status === 'new_or_missing'), 'new variables should be visible before install', initialModel.contextBoard.variables);
    assert(initialModel.eventBody.readinessChecklist.every((row) => row.ok), 'complex Demo draft should pass readiness before install', initialModel.eventBody.readinessChecklist);
    const initialHtml = previewEditor.render(initialModel);
    assert(initialHtml.includes('data-preview-object-choice-layout="player_path"'), 'new-event UI should render choices in a player-path layout for complex nested options');
    assert(initialHtml.includes('data-preview-object-choice-nested-section="committee_floor"') && initialHtml.includes('data-preview-object-inline-add="add_option"'), 'choice editor should expose child-choice entry points on follow-up/menu sections');
    assert(initialHtml.includes('data-preview-object-choice-logic="true"') && initialHtml.includes('data-preview-object-choice-logic-group="route"'), 'new-event UI should keep condition/route/effect editing inside each choice');
    const branchPanel = panelSegment(initialHtml, 'data-preview-object-branches="true"');
    assert(!branchPanel.includes('committee_floor'), 'choice-owned menu sections should not be duplicated in the bottom branch editor');
    assert(!branchPanel || branchPanel.includes('press_room'), 'unlinked provisional sections can remain in the bottom branch editor');
    assert(initialHtml.includes('data-preview-object-event-graph="true"'), 'new-event UI should render the complex event graph');

    const values = {
      structure_add_option_section_committee_floor: [
        '- @split_message: Split the message for district organizers.',
        '# split_message',
        'choose-if: demo_dynamic_pressure >= 2',
        'unavailable-subtitle: The committee has not created enough pressure.',
        'A narrower message travels to the districts before the public statement.'
      ].join('\n'),
      structure_add_branch: [
        '# corridor_briefing',
        '[? if demo_dynamic_pressure >= 2 : A corridor briefing captures the disagreement without opening a new scene. ?]'
      ].join('\n'),
      structure_add_trigger_effect: 'Q.demo_dynamic_pressure += 1 if demo_support >= 0',
      structure_remove_layer_press_room: 'true',
      structure_remove_option_effect_signal_committee_0: 'true'
    };
    const editedModel = canvasModel.buildNewEventCanvas(indexed.index, draft, {values});
    assert(editedModel.ok, 'edited complex Demo draft should stay valid', editedModel.changeState.diagnostics);
    assert(editedModel.eventBody.options.some((option) => option.id === 'split_message' && option.sectionId === 'committee_floor'), 'section add-option command should add a nested option', editedModel.eventBody.options);
    assert(editedModel.eventBody.branchSections.some((field) => field.sectionId === 'corridor_briefing'), 'add-branch command should add a same-event layer', editedModel.eventBody.branchSections);
    assert(!editedModel.eventBody.branchSections.some((field) => field.sectionId === 'press_room'), 'remove-layer command should remove the provisional layer before install', editedModel.eventBody.branchSections);
    assert(!editedModel.eventBody.optionEffects.some((group) => group.id === 'signal_committee' && group.fields.length), 'remove option-effect command should remove the selected option effect', editedModel.eventBody.optionEffects);
    assert(editedModel.eventBody.choiceUnits.some((choice) => choice.id === 'hold_line' && choice.continuation.nextTarget === 'committee_floor'), 'edited complex Demo should expose complete choice units and next playable step', editedModel.eventBody.choiceUnits);
    assert(editedModel.eventBody.consequenceGroups.some((group) => group.key === 'public_support'), 'edited complex Demo should expose grouped consequences', editedModel.eventBody.consequenceGroups);

    const editedTrial = complexAuthoring.runTrial(editedModel.eventBody, {
      initialState: {
        demo_support: 1,
        demo_conflict: 1,
        demo_dynamic_pressure: 0,
        demo_cabinet_balance: 0,
        demo_public_attention: 0
      },
      paths: [
        {name: 'pressure_to_minutes', choices: ['hold_line', 'publish_minutes']},
        {name: 'cabinet_bargain', choices: ['bargain']}
      ]
    });
    assert(editedTrial.ok, 'edited complex Demo should support a two-path lightweight trial run before install', editedTrial);
    assert(editedTrial.paths[0].finalState.demo_public_attention === 2, 'trial run should apply nested publish-minutes consequences', editedTrial.paths[0]);

    const plan = editedModel.changeState.installPlan;
    assert(plan && plan.operations.length >= 5, 'edited complex Demo draft should produce an executable install plan', plan);
    assert(plan.operations.some((op) => op.id === 'create_scene' && op.safety === 'safe_apply'), 'install plan should create the event scene safely', plan.operations);
    assert(plan.operations.some((op) => op.id === 'event_router_registration' && op.safety === 'advanced_apply'), 'install plan should include profile-aware router registration', plan.operations);
    assert(plan.operations.some((op) => op.id.indexOf('event_variable_init_demo_dynamic_pressure') === 0), 'install plan should initialize new effect variables', plan.operations);
    assert(!plan.operations.some((op) => op.type === 'manual_snippet'), 'starter Demo complex create should not fall back to manual snippets', plan.operations);

    const dryRun = installPlan.applyInstallPlan(plan, {projectRoot: prepared.root, dryRun: true, allowAdvanced: true});
    assert(dryRun.ok, 'complex create install plan dry-run should succeed', dryRun);
    assert(!resultStatuses(dryRun).some((status) => status === 'manual_review' || status === 'advanced_review' || status === 'failed'), 'dry-run should not leave review-only operations', dryRun.results);

    const applied = installPlan.applyInstallPlan(plan, {projectRoot: prepared.root, dryRun: false, allowAdvanced: true});
    assert(applied.ok, 'complex create install plan should apply to the writable Demo copy', applied);
    assert(!resultStatuses(applied).some((status) => status === 'manual_review' || status === 'advanced_review' || status === 'failed'), 'apply should execute all planned operations', applied.results);

    const eventPath = path.join(prepared.root, 'source', 'scenes', 'events', draft.id + '.scene.dry');
    const createdSource = fs.readFileSync(eventPath, 'utf8');
    assert(createdSource.includes('@committee_floor'), 'created source should include the retained committee branch');
    assert(createdSource.includes('@corridor_briefing'), 'created source should include the newly added branch');
    assert(!createdSource.includes('@press_room'), 'created source should not include the removed provisional branch');
    assert(createdSource.includes('Split the message for district organizers.'), 'created source should include the newly added nested option');
    const postEventSource = fs.readFileSync(path.join(prepared.root, 'source', 'scenes', 'post_event.scene.dry'), 'utf8');
    assert(
      postEventSource.includes('- @main: Return to the workspace hand\n- #event: Monthly event popups\n- @root: Back to the starter menu'),
      'router registration should keep the Dendry options block contiguous',
      postEventSource
    );
    assert(!postEventSource.includes('\n\n- #event'), 'router registration should not insert a blank line before #event', postEventSource);

    const reindexed = await core.buildProjectIndex({
      root: prepared.root,
      outDir: secondIndexRoot,
      includeExcerpts: false,
      python: pythonCommand(),
      desktopDir: DESKTOP_DIR
    });
    assert(reindexed.ok, 'starter demo should rebuild ProjectIndex after complex create apply', reindexed.error || reindexed);
    const newScene = sceneById(reindexed.index, draft.id);
    assert(newScene, 'reindexed ProjectIndex should include the newly created complex event scene', {
      summary: reindexed.summary,
      diagnostics: reindexed.index.diagnostics || reindexed.diagnostics || [],
      createdSourceAroundParserError: createdSource.split(/\r?\n/).slice(70, 84),
      scenes: (reindexed.index.scenes || []).map((scene) => ({
        id: scene.id,
        title: scene.title,
        path: scene.path,
        type: scene.type,
        flags: scene.flags
      }))
    });
    assert(newScene.options.length >= 4, 'reindexed complex event should keep root options', newScene.options);
    assert(hasLocalSection(newScene, 'committee_floor'), 'reindexed complex event should keep the committee branch section', newScene.sections);
    assert(hasLocalSection(newScene, 'corridor_briefing'), 'reindexed complex event should keep the created branch section', newScene.sections);
    assert(!hasLocalSection(newScene, 'press_room'), 'reindexed complex event should not resurrect the removed branch section', newScene.sections);
    assert(hasText(reindexed.index, 'Split the message for district organizers.'), 'reindexed text corpus should include the nested option label');

    const reopened = canvasModel.buildCanvasModel(reindexed.index, {template: 'existing', view: 'events', sceneId: draft.id}, {});
    assert(reopened.ok, 'newly created complex event should reopen as an existing editable object', reopened.changeState.diagnostics);
    assert(reopened.mode === 'existing', 'reopened complex event should use existing mode', reopened.mode);
    assert(reopened.eventBody.options.length >= 4, 'existing editor should expose options after re-open', reopened.eventBody.options);
    assert(reopened.eventBody.branchSections.length >= 2, 'existing editor should expose branch/result layers after re-open', reopened.eventBody.branchSections);
    assert(reopened.eventBody.choiceUnits.length >= 4, 'reopened complex event should expose complete choice units', reopened.eventBody.choiceUnits);
    assert(reopened.eventBody.continuationMap.summary.directRoutes >= 1 || reopened.eventBody.continuationMap.summary.menuReturns >= 1, 'reopened complex event should expose continuation map', reopened.eventBody.continuationMap);
    assert(hasAction(reopened.eventBody, 'add_branch', (field) => field.editability === 'advanced_source_patch'), 'existing editor should expose advanced add-branch after re-open', reopened.eventBody.structureActions);
    assert(hasAction(reopened.eventBody, 'remove_option'), 'existing editor should expose option deletion after re-open', reopened.eventBody.structureActions);
    assert(hasAction(reopened.eventBody, 'remove_layer'), 'existing editor should expose layer deletion after re-open', reopened.eventBody.structureActions);
    assert(hasAction(reopened.eventBody, 'add_option', (field) => String(field.sectionId || '').includes('committee_floor')), 'existing editor should expose section-owned add-option after re-open', reopened.eventBody.structureActions);
    const reopenedHtml = previewEditor.render(reopened);
    assert(reopenedHtml.includes('data-preview-object-structure-builder="add_option"'), 'reopened existing UI should render add-option controls');
    assert(reopenedHtml.includes('data-preview-object-structure-builder="add_branch"'), 'reopened existing UI should render add-branch controls');
    assert(reopenedHtml.includes('Remove layer'), 'reopened existing UI should render layer deletion controls');

    return {
      ok: true,
      sceneId: draft.id,
      operations: plan.operations.length,
      sceneCount: reindexed.summary.sceneCount,
      reopenedOptions: reopened.eventBody.options.length,
      reopenedActions: reopened.eventBody.structureActions.length
    };
  } finally {
    fs.rmSync(workspaceRoot, {recursive: true, force: true});
    fs.rmSync(firstIndexRoot, {recursive: true, force: true});
    fs.rmSync(secondIndexRoot, {recursive: true, force: true});
  }
}

async function main() {
  const report = await runStarterDemoComplexEventCreate();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

if (require.main === module) {
  main().catch((err) => {
    fail(err && err.stack ? err.stack : String(err));
  });
} else {
  module.exports = {runStarterDemoComplexEventCreate};
}
