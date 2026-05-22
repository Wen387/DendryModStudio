#!/usr/bin/env node
'use strict';

const objectCanvasModel = require('./authoring/object_authoring_canvas_model.js');
global.ProjectMapSystemUiFixtureState = require('./viewer/system_ui_fixture_state.js');
global.ProjectMapSystemUiRegionContext = require('./viewer/system_ui_region_context.js');
global.ProjectMapSystemUiCapabilityModel = require('./viewer/system_ui_capability_model.js');
global.ProjectMapSystemUiSemanticTaskModel = require('./viewer/system_ui_semantic_task_model.js');
const screenModel = require('./viewer/system_ui_screen_model.js');

function fail(message, extra) {
  process.stderr.write('FAIL: ' + message + '\n');
  if (extra) {
    process.stderr.write(JSON.stringify(extra, null, 2) + '\n');
  }
  process.exit(1);
}

function assert(condition, message, extra) {
  if (!condition) {
    fail(message, extra);
  }
}

const projectIndex = {
  project: {name: 'Semantic UI Fixture', root: '/tmp/system-ui-semantic-fixture'},
  scenes: [
    scene('root', 'Dynamic Social Democracy', 'source/scenes/root.scene.dry', 'root'),
    Object.assign(scene('library', 'Library', 'source/scenes/library.scene.dry', 'event'), {
      flags: {isSpecial: true},
      sections: [{id: 'library.government', sourceSpan: {path: 'source/scenes/library.scene.dry', startLine: 12, endLine: 20}}]
    }),
    Object.assign(scene('status', 'Status', 'source/scenes/status.scene.dry', 'status'), {
      metadata: {title: {path: 'source/scenes/status.scene.dry', line: 1}},
      sections: [{id: 'status.politics', sourceSpan: {path: 'source/scenes/status.scene.dry', startLine: 8, endLine: 16}}]
    })
  ],
  semantic: {
    textCorpus: {
      items: [
        textItem('root_title', 'Dynamic Social Democracy', 'title', 'root', 'source/scenes/root.scene.dry', 1),
        textItem('root_intro', 'Read.', 'body', 'root', 'source/scenes/root.scene.dry', 8),
        textItem('root_option', 'Start', 'option_label', 'root', 'source/scenes/root.scene.dry', 15, 'main'),
        textItem('library_heading', 'Government', 'heading', 'library', 'source/scenes/library.scene.dry', 13, 'library.government'),
        textItem('library_body', 'The Library explains the background institutions.', 'body', 'library', 'source/scenes/library.scene.dry', 15, 'library.government'),
        textItem('status_title', 'Status', 'title', 'status', 'source/scenes/status.scene.dry', 1),
        textItem('status_heading', 'Policy Desk', 'heading', 'status', 'source/scenes/status.scene.dry', 9, 'status.politics'),
        textItem('status_body', 'Coalition pressure is visible here.', 'body', 'status', 'source/scenes/status.scene.dry', 11, 'status.politics')
      ]
    },
    electionResults: {
      items: [{
        id: 'reichstag_results_event',
        title: 'Reichstag Results',
        subtitle: 'Reichstag election results',
        path: 'source/scenes/events/election_1928.scene.dry',
        line: 88,
        seatsTotal: '493',
        parties: [{key: 'spd', name: 'SPD', color: '#E3000F', seats: '153'}],
        choices: [{key: 'accept', label: 'Accept the result'}],
        reason: 'd3_parliament'
      }]
    }
  }
};

['entry', 'project', 'workspace_layout', 'sidebar_status', 'play_surface', 'election_results'].forEach((template) => {
  const model = objectCanvasModel.buildTemplateCanvas(projectIndex, template, {}, {values: {}});
  const screen = screenModel.buildScreen(model, {projectIndex});
  assert(screen.semanticTaskMatrix && screen.semanticTaskMatrix.kind === 'system_ui_semantic_task_matrix', template + ' should expose semantic task matrix');
  assert(screen.regions.every((region) => Array.isArray(region.semanticTasks) && region.semanticTasks.length), template + ' should attach semantic tasks to every region');
  screen.regions.forEach((region) => {
    region.semanticTasks.forEach((task) => validateTask(task, region));
  });
});

const projectScreen = screenModel.buildScreen(objectCanvasModel.buildTemplateCanvas(projectIndex, 'project', {}, {values: {}}), {projectIndex, selected: 'ui:screen_header'});
const topChrome = taskByIntent(projectScreen.selected, 'top_chrome_menu');
assert(topChrome && topChrome.actionKind === 'top_chrome_diagnostics', 'header should expose Top Chrome diagnostics task');
assert(topChrome.safety === 'manual_review', 'Top Chrome generated menu labels should stay manual review');
assert(topChrome.runtimeEvidenceState === 'generated_only', 'Top Chrome menu labels should classify as generated-only until source-backed');
const libraryContent = taskByIntent(projectScreen.selected, 'library_content');
assert(libraryContent && libraryContent.actionKind === 'open_content_scene', 'header should expose Library page content separately from Top Chrome');
assert(libraryContent.safety === 'guarded_apply', 'Library page content should inherit source-backed guarded support');
assert(libraryContent.sourceEvidenceState === 'source_backed', 'Library page content should report source-backed evidence');

const sidebarScreen = screenModel.buildScreen(objectCanvasModel.buildTemplateCanvas(projectIndex, 'sidebar_status', {}, {values: {}}), {projectIndex, selected: 'ui:sidebar_category:politics'});
const sidebarTask = taskByIntent(sidebarScreen.selected, 'sidebar_edit_section');
assert(sidebarTask && sidebarTask.actionKind === 'sidebar_composer', 'sidebar should expose Sidebar Composer edit task');
assert(sidebarTask.fields.some((field) => field.id === 'sidebar.sectionHeading'), 'sidebar task should include section heading field');
const sidebarDeleteTask = taskByIntent(sidebarScreen.selected, 'sidebar_delete_category');
assert(sidebarDeleteTask && sidebarDeleteTask.actionKind === 'sidebar_composer', 'sidebar should expose Sidebar Composer delete task');
assert(sidebarDeleteTask.fields.some((field) => field.id === 'sidebar.deleteConfirm'), 'sidebar delete task should include explicit confirmation field');

const layoutScreen = screenModel.buildScreen(objectCanvasModel.buildTemplateCanvas(projectIndex, 'workspace_layout', {}, {values: {}}), {projectIndex, selected: 'ui:layout_frame'});
const addCategory = taskByIntent(layoutScreen.selected, 'sidebar_add_category');
assert(addCategory && addCategory.actionKind === 'sidebar_composer', 'layout frame should expose add-sidebar-category task');
assert(addCategory.fields.some((field) => field.id === 'layout.sidebarHeading'), 'add-category task should include sidebar heading field');

const electionScreen = screenModel.buildScreen(objectCanvasModel.buildTemplateCanvas(projectIndex, 'election_results', {}, {values: {}}), {projectIndex, selected: 'ui:election_results_chart'});
const chartTask = taskByIntent(electionScreen.selected, 'election_chart_review');
assert(chartTask && chartTask.actionKind === 'runtime_review', 'election chart should stay runtime-review task');
assert(chartTask.manualReason, 'runtime-review task should explain manual boundary');

process.stdout.write(JSON.stringify({ok: true, regions: projectScreen.regions.length}, null, 2) + '\n');

function validateTask(task, region) {
  [
    'id',
    'intent',
    'label',
    'beginnerSummary',
    'regionKey',
    'template',
    'internalTemplate',
    'fields',
    'primaryFieldId',
    'actionKind',
    'safety',
    'sourceEvidenceState',
    'runtimeEvidenceState',
    'manualReason'
  ].forEach((key) => {
    assert(Object.prototype.hasOwnProperty.call(task, key), 'semantic task should include ' + key, {task, region: region.key});
  });
  assert(task.regionKey === region.key, 'semantic task should stay attached to its region', {task, region: region.key});
  assert(['safe_apply', 'guarded_apply', 'manual_review', 'advanced_apply', ''].includes(String(task.safety || '')), 'semantic task safety should use capability-style safety', task);
}

function taskByIntent(region, intent) {
  return (region.semanticTasks || []).find((task) => task.intent === intent);
}

function scene(id, title, path, type) {
  return {id, title, path, type, sourceSpan: {path, startLine: 1, endLine: 30}};
}

function textItem(id, text, role, sceneId, path, line, itemId) {
  const source = {path, line, startLine: line, endLine: line};
  return {
    id,
    text,
    label: text,
    role,
    owner: {sceneId, sectionId: itemId || ''},
    source,
    sourceSpan: source
  };
}
