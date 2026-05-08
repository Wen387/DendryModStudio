#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const VIEWER = path.join(ROOT, 'viewer');
const INDEX = path.join(VIEWER, 'index.html');
const CONTENT_STORYBOARD_MODEL = path.join(ROOT, 'authoring', 'content_storyboard_model.js');
const CARD_BOARD_MODEL = path.join(ROOT, 'authoring', 'card_board_model.js');
const STORY_SCOPE_MODEL = path.join(ROOT, 'authoring', 'story_scope_model.js');
const STORY_CHAIN_GRAPH_MODEL = path.join(ROOT, 'authoring', 'story_chain_graph_model.js');
const STORY_PALETTE_MODEL = path.join(ROOT, 'authoring', 'story_palette_model.js');
const TIMELINE_PROFILE_MODEL = path.join(ROOT, 'authoring', 'timeline_profile_model.js');
const TIMELINE_COORDINATE_ADAPTER = path.join(ROOT, 'authoring', 'timeline_coordinate_adapter.js');
const AUTHORING_SURFACE_REGISTRY = path.join(VIEWER, 'authoring_surface_registry.js');
const AUTHORING_SURFACE_GRAPHS = path.join(VIEWER, 'authoring_surface_graphs.js');
const AUTHORING_REFERENCE_INDEX = path.join(VIEWER, 'authoring_reference_index.js');
const CONTENT_STORYBOARD_SURFACE = path.join(VIEWER, 'content_storyboard_surface.js');
const VISIBLE_TEXT_RENDERER = path.join(VIEWER, 'visible_text_renderer.js');
const LIGHTWEIGHT_OBJECT_PREVIEW = path.join(VIEWER, 'lightweight_object_preview.js');
const PREVIEW_OBJECT_EDITOR = path.join(VIEWER, 'preview_object_editor.js');
const STORYBOARD_SCOPE_CONTROLS = path.join(VIEWER, 'storyboard_scope_controls.js');
const STORYBOARD_CARD_RENDERER = path.join(VIEWER, 'storyboard_card_renderer.js');
const STORYBOARD_PALETTE_SIDEBAR = path.join(VIEWER, 'storyboard_palette_sidebar.js');
const STORYBOARD_WORKSPACE_STATE = path.join(VIEWER, 'storyboard_workspace_state.js');
const CONTENT_STORYBOARD_INTERACTIONS = path.join(VIEWER, 'content_storyboard_interactions.js');
const RUNTIME_LENS_MODEL = path.join(ROOT, 'authoring', 'runtime_lens_model.js');
const RUNTIME_LENS_UI = path.join(VIEWER, 'runtime_lens_ui.js');
const RUNTIME_LENS_WORKSPACE_STATE = path.join(VIEWER, 'runtime_lens_workspace_state.js');
const CARD_FACE_EDITOR = path.join(VIEWER, 'card_face_editor.js');
const CARD_BOARD_SURFACE = path.join(VIEWER, 'card_board_surface.js');
const CARD_BOARD_INTERACTIONS = path.join(VIEWER, 'card_board_interactions.js');
const CARD_WORKSPACE_STATE = path.join(VIEWER, 'card_workspace_state.js');
const CONTENT_GRAPH_INTERACTIONS = path.join(VIEWER, 'content_graph_interactions.js');
const PROJECT_STATE_SURFACE = path.join(VIEWER, 'project_state_surface.js');
const VARIABLE_EDITOR_UI = path.join(VIEWER, 'variable_editor_ui.js');
const SYSTEM_UI_FIXTURE_STATE = path.join(VIEWER, 'system_ui_fixture_state.js');
const SYSTEM_UI_REGION_CONTEXT = path.join(VIEWER, 'system_ui_region_context.js');
const SYSTEM_UI_WORKSPACE_STATE = path.join(VIEWER, 'system_ui_workspace_state.js');
const SYSTEM_UI_SCREEN_MODEL = path.join(VIEWER, 'system_ui_screen_model.js');
const SYSTEM_UI_SCREEN_PREVIEW = path.join(VIEWER, 'system_ui_screen_preview.js');
const SYSTEM_UI_REGION_ROUTER = path.join(VIEWER, 'system_ui_region_router.js');
const SYSTEM_UI_REGION_EDITOR = path.join(VIEWER, 'system_ui_region_editor.js');
const SYSTEM_UI_PREVIEW_SURFACE = path.join(VIEWER, 'system_ui_preview_surface.js');
const ELECTION_RESULTS_CHART = path.join(VIEWER, 'election_results_chart.js');
const ELECTION_RESULTS_SURFACE = path.join(VIEWER, 'election_results_surface.js');
const OBJECT_CANVAS_VIEWPORT = path.join(VIEWER, 'object_canvas_viewport.js');
const OBJECT_CANVAS_GRAPH_STAGE = path.join(VIEWER, 'object_canvas_graph_stage.js');
const AUTHORING_WORKSPACE_UI = path.join(VIEWER, 'authoring_workspace_ui.js');
const OBJECT_CANVAS_UI = path.join(VIEWER, 'object_authoring_canvas_ui.js');
const CHANGE_TRAY_UI = path.join(VIEWER, 'change_tray_ui.js');
const CREATE_STYLE = path.join(VIEWER, 'styles', 'create.css');
const INSTALL_PREVIEW_STYLE = path.join(VIEWER, 'styles', 'install-preview.css');
const EDITING_STYLE = path.join(VIEWER, 'styles', 'editing.css');
const CARD_BOARD_STYLE = path.join(VIEWER, 'styles', 'card-board.css');
const HARNESS = path.join(ROOT, 'qa', 'authoring_canvas_screenshot_harness.html');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const html = read(INDEX);
const contentStoryboardModel = read(CONTENT_STORYBOARD_MODEL);
const cardBoardModel = read(CARD_BOARD_MODEL);
const storyScopeModel = read(STORY_SCOPE_MODEL);
const storyChainGraphModel = read(STORY_CHAIN_GRAPH_MODEL);
const storyPaletteModel = read(STORY_PALETTE_MODEL);
const timelineProfileModel = read(TIMELINE_PROFILE_MODEL);
const timelineCoordinateAdapter = read(TIMELINE_COORDINATE_ADAPTER);
const surfaceRegistry = read(AUTHORING_SURFACE_REGISTRY);
const surfaceGraphs = read(AUTHORING_SURFACE_GRAPHS);
const referenceIndex = read(AUTHORING_REFERENCE_INDEX);
const contentStoryboardSurface = read(CONTENT_STORYBOARD_SURFACE);
const visibleTextRenderer = read(VISIBLE_TEXT_RENDERER);
const lightweightObjectPreview = read(LIGHTWEIGHT_OBJECT_PREVIEW);
const previewObjectEditor = read(PREVIEW_OBJECT_EDITOR);
const visibleTextApi = require(VISIBLE_TEXT_RENDERER);
const previewObjectEditorApi = require(PREVIEW_OBJECT_EDITOR);
const contentStoryboardInteractionsApi = require(CONTENT_STORYBOARD_INTERACTIONS);
const storyboardCardRendererApi = require(STORYBOARD_CARD_RENDERER);
const storyboardScopeControls = read(STORYBOARD_SCOPE_CONTROLS);
const storyboardCardRenderer = read(STORYBOARD_CARD_RENDERER);
const storyboardPaletteSidebar = read(STORYBOARD_PALETTE_SIDEBAR);
const storyboardWorkspaceState = read(STORYBOARD_WORKSPACE_STATE);
const contentStoryboardInteractions = read(CONTENT_STORYBOARD_INTERACTIONS);
const runtimeLensModel = read(RUNTIME_LENS_MODEL);
const runtimeLensUi = read(RUNTIME_LENS_UI);
const runtimeLensWorkspaceState = read(RUNTIME_LENS_WORKSPACE_STATE);
const cardFaceEditor = read(CARD_FACE_EDITOR);
const cardBoardSurface = read(CARD_BOARD_SURFACE);
const cardBoardInteractions = read(CARD_BOARD_INTERACTIONS);
const cardWorkspaceState = read(CARD_WORKSPACE_STATE);
const contentInteractions = read(CONTENT_GRAPH_INTERACTIONS);
const projectStateSurface = read(PROJECT_STATE_SURFACE);
const variableEditorUi = read(VARIABLE_EDITOR_UI);
const systemUiFixtureState = read(SYSTEM_UI_FIXTURE_STATE);
const systemUiRegionContext = read(SYSTEM_UI_REGION_CONTEXT);
const systemUiWorkspaceState = read(SYSTEM_UI_WORKSPACE_STATE);
const systemUiScreenModel = read(SYSTEM_UI_SCREEN_MODEL);
const systemUiScreenPreview = read(SYSTEM_UI_SCREEN_PREVIEW);
const systemUiRegionRouter = read(SYSTEM_UI_REGION_ROUTER);
const systemUiRegionEditor = read(SYSTEM_UI_REGION_EDITOR);
const systemUiPreviewSurface = read(SYSTEM_UI_PREVIEW_SURFACE);
const electionResultsChart = read(ELECTION_RESULTS_CHART);
const electionResultsSurface = read(ELECTION_RESULTS_SURFACE);
const objectCanvasViewport = read(OBJECT_CANVAS_VIEWPORT);
const objectCanvasGraphStage = read(OBJECT_CANVAS_GRAPH_STAGE);
const workspaceUi = read(AUTHORING_WORKSPACE_UI);
const canvasUi = read(OBJECT_CANVAS_UI);
const changeTrayUi = read(CHANGE_TRAY_UI);
const createStyle = read(CREATE_STYLE);
const installPreviewStyle = read(INSTALL_PREVIEW_STYLE);
const editingStyle = read(EDITING_STYLE);
const cardBoardStyle = read(CARD_BOARD_STYLE);
const harness = read(HARNESS);

const workspaces = ['content', 'system_ui', 'project_state'];
const groupedTemplates = {
  content: ['event', 'news', 'card'],
  system_ui: ['entry', 'election_results', 'project'],
  project_state: ['variables']
};
const internalSystemUiTemplates = ['entry', 'play_surface', 'workspace_layout', 'sidebar_status', 'project'];

assert(html.includes('data-authoring-workspace-nav'), 'Create should keep a small Authoring Workspace host in index.html');
assert(html.includes('../authoring/content_storyboard_model.js'), 'viewer should load the Content Storyboard model');
assert(html.includes('../authoring/runtime_lens_model.js'), 'viewer should load the Runtime Lens model');
assert(html.includes('../authoring/card_board_model.js'), 'viewer should load the Card Board model');
assert(html.includes('../authoring/edit_capability_model.js'), 'viewer should load the Parser-aware Edit Capability model');
assert(html.includes('../authoring/story_scope_model.js'), 'viewer should load the Story Scope model');
assert(html.includes('../authoring/story_chain_graph_model.js'), 'viewer should load the Story Chain Graph model');
assert(html.includes('../authoring/story_palette_model.js'), 'viewer should load the Story Palette model');
assert(html.includes('../authoring/timeline_profile_model.js'), 'viewer should load the Timeline Profile model');
assert(html.includes('../authoring/timeline_coordinate_adapter.js'), 'viewer should load the Timeline Coordinate adapter');
assert(html.includes('authoring_surface_registry.js'), 'viewer should load the Authoring Surface registry before workspace UI');
assert(html.includes('authoring_surface_graphs.js'), 'viewer should load authoring surface graph builders');
assert(html.includes('authoring_reference_index.js'), 'viewer should load authoring reference index helpers');
assert(html.includes('storyboard_scope_controls.js'), 'viewer should load Storyboard scope controls');
assert(html.includes('storyboard_card_renderer.js'), 'viewer should load Storyboard card renderer');
assert(html.includes('storyboard_palette_sidebar.js'), 'viewer should load Storyboard palette sidebar');
assert(html.includes('lightweight_object_preview.js'), 'viewer should load the lightweight Studio object preview');
assert(html.includes('preview_object_editor.js'), 'viewer should load the visible Preview Object Editor');
assert(html.includes('storyboard_workspace_state.js'), 'viewer should load Storyboard workspace state');
assert(html.includes('content_storyboard_surface.js'), 'viewer should load Content Storyboard surface');
assert(html.includes('content_storyboard_interactions.js'), 'viewer should load Content Storyboard interactions');
assert(html.includes('visible_text_renderer.js'), 'viewer should load the shared visible text renderer before object previews');
assert(html.includes('runtime_lens_ui.js'), 'viewer should load Runtime Lens UI');
assert(html.includes('runtime_lens_workspace_state.js'), 'viewer should load Runtime Lens workspace state');
assert(html.includes('card_face_editor.js'), 'viewer should load Card Face editor');
assert(html.includes('card_board_surface.js'), 'viewer should load Card Board surface');
assert(html.includes('card_board_interactions.js'), 'viewer should load Card Board interactions');
assert(html.includes('card_workspace_state.js'), 'viewer should load Card Board workspace state');
assert(html.includes('content_graph_interactions.js'), 'viewer should load Content Graph interactions');
assert(html.includes('project_state_surface.js'), 'viewer should load Project State Dependency Board surface');
assert(html.includes('system_ui_fixture_state.js'), 'viewer should load System UI fixture helper');
assert(html.includes('system_ui_region_context.js'), 'viewer should load System UI context helper');
assert(html.includes('system_ui_workspace_state.js'), 'viewer should load System UI workspace state helper');
assert(html.includes('system_ui_screen_model.js'), 'viewer should load System UI Screen model');
assert(html.includes('system_ui_screen_preview.js'), 'viewer should load System UI Screen preview');
assert(html.includes('system_ui_region_router.js'), 'viewer should load System UI region router');
assert(html.includes('system_ui_region_editor.js'), 'viewer should load System UI region editor');
assert(html.includes('system_ui_preview_surface.js'), 'viewer should load System UI Live Preview surface');
assert(html.includes('election_results_chart.js'), 'viewer should load the D3-compatible Election Results chart renderer');
assert(html.includes('election_results_surface.js'), 'viewer should load the Election Results workspace surface');
assert(html.includes('../authoring/election_results_draft.js'), 'viewer should load Election Results draft core');
assert(html.includes('object_canvas_viewport.js'), 'viewer should load Object Canvas viewport controls');
assert(html.includes('object_canvas_graph_stage.js'), 'viewer should load the fallback Object Canvas graph stage');
assert(html.includes('change_tray_ui.js'), 'viewer should load the floating Change Tray UI');
assert(surfaceRegistry.includes('content_storyboard'), 'Surface registry should define the Content Storyboard surface');
assert(surfaceRegistry.includes('card_board'), 'Surface registry should define the Card Board surface');
assert(surfaceRegistry.includes('system_ui_preview'), 'Surface registry should define the System UI Preview surface');
assert(surfaceRegistry.includes('election_results_board'), 'Surface registry should define the Election Results workspace surface');
assert(surfaceRegistry.includes('project_state_board'), 'Surface registry should define the Project State Board surface');

workspaces.forEach((workspace) => {
  assert(workspaceUi.includes("key: '" + workspace + "'"), workspace + ' workspace should be available in Create');
  assert(workspaceUi.includes('data-authoring-template-group'), workspace + ' templates should be grouped under their workspace');
  assert(workspaceUi.includes(workspace), workspace + ' should be known to the workspace controller');
});

Object.keys(groupedTemplates).forEach((workspace) => {
  groupedTemplates[workspace].forEach((template) => {
    assert(workspaceUi.includes("key: '" + template + "'"), template + ' should stay reachable from Create');
    assert(surfaceRegistry.includes("key: '" + template + "'"), template + ' should be registered as an authoring template');
    assert(surfaceRegistry.includes("workspace: '" + workspace + "'"), workspace + ' workspace mappings should live in the registry');
  });
});
internalSystemUiTemplates.forEach((template) => {
  assert(surfaceRegistry.includes("key: '" + template + "'"), template + ' should remain registered as an internal System UI draft template');
});
assert(surfaceRegistry.includes("key: 'surface'"), 'Text Patch should remain registered for drafts and fallback loading');
assert(surfaceRegistry.includes('hidden: true'), 'Text Patch should be hidden from primary Content tabs');
assert(surfaceRegistry.includes('!item.hidden'), 'Workspace template lists should filter hidden fallback templates');
assert(!workspaceUi.includes("{key: 'surface', labelKey: 'create.editText'"), 'Text Patch should not be a primary Content tab');
assert(workspaceUi.includes('SYSTEM_UI_SCREEN_ITEM'), 'System UI workspace should expose one visible screen entry');
assert(workspaceUi.includes('ELECTION_RESULTS_ITEM'), 'System UI workspace should expose Election Results as a separate authoring subcategory');
assert(workspaceUi.includes('return [SYSTEM_UI_SCREEN_ITEM, ELECTION_RESULTS_ITEM]'), 'System UI workspace should show System UI Screen plus Election Results, not the internal screen templates');
assert(canvasUi.includes('systemUiTemplateForRegion'), 'Object Canvas should switch internal System UI draft type from preview-region clicks');
assert(canvasUi.includes('renderElectionResultsStage'), 'Object Canvas should render Election Results through its dedicated surface');
assert(electionResultsChart.includes('data-d3-parliament-chart'), 'Election Results chart should expose a D3 parliament-compatible chart marker');
assert(electionResultsChart.includes('d3.parliament'), 'Election Results chart should directly call d3.parliament when the runtime provides it');
assert(electionResultsSurface.includes('data-election-results-source-selector'), 'Election Results surface should expose a source event selector');
assert(electionResultsSurface.includes('create_election_event'), 'Election Results surface should expose a new election event action');
assert(canvasUi.includes('templateMatchesExistingView'), 'Object Canvas should keep same-template events from replacing existing edits with new drafts');
assert(canvasUi.includes('templateForExistingView'), 'Object Canvas should map existing views back to their authoring templates');
assert(canvasUi.includes('if (templateMatchesExistingView(nextTemplate))'), 'Object Canvas template opening should guard existing card/advisor selections at the final open path');
assert(canvasUi.includes('boardChromeCollapsed'), 'Content and Card boards should expose a collapsible board detail state');
assert(canvasUi.includes('toggle_board_chrome'), 'Object Canvas should let users collapse Content/Card board detail chrome');
assert(systemUiRegionRouter.includes('ProjectMapSystemUiRegionRouter'), 'System UI region router should expose a browser API');
assert(systemUiRegionRouter.includes("deck_lane: 'workspace_layout'"), 'System UI region router should map deck clicks to the layout draft');
assert(systemUiRegionRouter.includes("screen_header: 'project'"), 'System UI region router should map header clicks to the Game Info draft');
assert(systemUiRegionRouter.includes("election_results_chart: 'election_results'"), 'System UI region router should map election-result clicks to the Election Results draft');
assert(systemUiScreenPreview.includes('data-system-election-results'), 'System UI preview should render the Election Results WYSIWYG screen');

assert(surfaceRegistry.includes("defaultTemplate: 'entry'"), 'System UI workspace should default to Entry & Sidebar');
assert(surfaceRegistry.includes("defaultTemplate: 'variables'"), 'Project State workspace should default to Variables');
assert(workspaceUi.includes('ProjectMapAuthoringSurfaceRegistry'), 'Workspace navigation should consume the shared surface registry');
assert(canvasUi.includes('ProjectMapAuthoringSurfaceRegistry'), 'Object Canvas should consume the shared surface registry');
assert(canvasUi.includes('data-authoring-surface'), 'Object Canvas should expose the active authoring surface');
assert(contentStoryboardModel.includes('ProjectMapContentStoryboardModel'), 'Content Storyboard model should expose a browser API');
assert(cardBoardModel.includes('ProjectMapCardBoardModel'), 'Card Board model should expose a browser API');
assert(cardBoardModel.includes('buildBoard'), 'Card Board model should build hand/deck/advisor lanes');
assert(storyScopeModel.includes('ProjectMapStoryScopeModel'), 'Story Scope model should expose a browser API');
assert(storyScopeModel.includes('summaryLanes'), 'Story Scope model should preserve overview lanes');
assert(storyChainGraphModel.includes('ProjectMapStoryChainGraphModel'), 'Story Chain Graph model should expose a browser API');
assert(storyChainGraphModel.includes('chainConnectors'), 'Story Chain Graph model should build visible connectors');
assert(storyPaletteModel.includes('ProjectMapStoryPaletteModel'), 'Story Palette model should expose a browser API');
assert(storyPaletteModel.includes('buildPalette'), 'Story Palette model should build context-matching groups');
assert(timelineProfileModel.includes('ProjectMapTimelineProfileModel'), 'Timeline Profile model should expose a browser API');
assert(timelineCoordinateAdapter.includes('ProjectMapTimelineCoordinateAdapter'), 'Timeline Coordinate adapter should expose a browser API');
assert(contentStoryboardModel.includes('ProjectMapTimelineCoordinateAdapter'), 'Content Storyboard should consume the Timeline Coordinate adapter');
assert(contentStoryboardModel.includes('buildTimeline'), 'Content Storyboard model should build timeline lanes');
assert(contentStoryboardModel.includes('buildChain'), 'Content Storyboard model should build story chains');
assert(contentStoryboardModel.includes('filterCardsForCanvas'), 'Content Storyboard model should keep Canvas category filtering in the model layer');
assert(contentStoryboardModel.includes('cardMatchesSearch'), 'Content Storyboard model should support quick search filtering');
assert(contentStoryboardSurface.includes('ProjectMapContentStoryboardSurface'), 'Content Storyboard surface should expose a browser API');
assert(contentStoryboardSurface.includes('ProjectMapLightweightObjectPreview'), 'Content Storyboard should render the lightweight Studio preview before review details');
assert(lightweightObjectPreview.includes('ProjectMapLightweightObjectPreview'), 'Lightweight object preview should expose a browser API');
assert(visibleTextRenderer.includes('ProjectMapVisibleTextRenderer'), 'Visible Text Renderer should expose a browser API');
assert(visibleTextRenderer.includes('sanitizeStyle'), 'Visible Text Renderer should sanitize inline CSS before rendering source HTML');
assert(visibleTextRenderer.includes('dendry-text-variable'), 'Visible Text Renderer should distinguish Dendry variable consumers');
assert(previewObjectEditor.includes('renderTextBlocks'), 'Preview Object Editor should expose rich text block rendering for live field mirrors');
assert(lightweightObjectPreview.includes('data-lightweight-object-preview'), 'Lightweight object preview should expose a stable QA marker');
assert(lightweightObjectPreview.includes('data-card-face-preview'), 'Lightweight card preview should keep the Card Board preview marker');
assert(!lightweightObjectPreview.includes('data-runtime-lens-frame'), 'Lightweight object preview should not embed runtime frames');
assert(!lightweightObjectPreview.includes('dendryDesktop'), 'Lightweight object preview should not call the desktop bridge');
assert(previewObjectEditor.includes('ProjectMapPreviewObjectEditor'), 'Preview Object Editor should expose a browser API');
assert(previewObjectEditor.includes('data-preview-object-editor'), 'Preview Object Editor should expose a stable QA marker');
assert(previewObjectEditor.includes('data-object-canvas-field'), 'Preview Object Editor should write through object-canvas draft fields');
assert(previewObjectEditor.includes('data-preview-object-text-replacement'), 'Preview Object Editor should render a dedicated text replacement mode');
assert(previewObjectEditor.includes('data-card-face-preview'), 'Preview Object Editor should keep the Card Board card face marker');
assert(contentStoryboardSurface.includes('data-content-storyboard-surface'), 'Content Storyboard surface should expose a stable QA marker');
assert(contentStoryboardSurface.includes('data-content-storyboard-category-filter'), 'Content Storyboard surface should expose category filters for story/card/all Canvas scope');
assert(contentStoryboardSurface.includes('data-content-storyboard-search'), 'Content Storyboard surface should expose quick search');
assert(contentStoryboardSurface.includes('laneWidth = 1060'), 'Content Storyboard timeline lanes should be wide enough for three-card rows');
assert(previewObjectEditor.includes('renderModal'), 'Preview Object Editor should render as a floating modal workspace');
assert(previewObjectEditor.includes('data-object-editing-modal'), 'Preview Object Editor modal should expose a stable modal marker');
assert(previewObjectEditor.includes('data-object-editing-modal-preview-pane'), 'Preview Object Editor modal should separate live preview from editable fields');
assert(previewObjectEditor.includes('data-preview-object-branches'), 'Preview Object Editor should separate conditional/follow-up text from opening prose');
assert(previewObjectEditor.includes('data-object-editing-preview-branches'), 'Preview Object Editor live preview should show branch text without flattening it into the opening page');
const richVisibleText = visibleTextApi.renderBlocks([
  '= Election results',
  'The <span style="color: #c00000;">**SPD**</span> has [+ spd_r : qdemo_level +] seats.',
  '[? if coalition_ready: <span style="color: red;">SPD</span> leads the coalition. ?]'
].join('\n'));
assert(richVisibleText.includes('style="color: #c00000"'), 'Visible Text Renderer should preserve safe party-color inline CSS');
assert(richVisibleText.includes('<strong>SPD</strong>'), 'Visible Text Renderer should preserve Markdown emphasis inside safe HTML spans');
assert(richVisibleText.includes('dendry-text-variable'), 'Visible Text Renderer should render variable consumers as distinct tokens');
assert(richVisibleText.includes('dendry-text-conditional'), 'Visible Text Renderer should render conditionals as distinct tokens');
assert(richVisibleText.includes('<code>coalition_ready</code>'), 'Visible Text Renderer should keep standalone conditional logic visible');
const inlineConditionalTitle = visibleTextApi.renderInline('[? if z_party_name != "CVP": <span style="color: #000000;">Center Party</span>?][? if z_party_name == "CVP": <span style="color: #000000;">**CVP**</span>?] Conference');
assert(inlineConditionalTitle.includes('dendry-text-conditional-inline'), 'Visible Text Renderer should keep embedded conditionals compact in titles and prose');
assert(inlineConditionalTitle.includes('Center Party') && inlineConditionalTitle.includes('CVP') && inlineConditionalTitle.includes('Conference'), 'Visible Text Renderer should preserve inline conditional alternatives');
assert(!inlineConditionalTitle.includes('<code>z_party_name'), 'Visible Text Renderer should not inflate inline conditional alternatives into condition cards');
assert(visibleTextApi.renderBlocks('<table><tr><td>DNVP</td><td>54</td></tr></table>').includes('dendry-text-rich-block'), 'Visible Text Renderer should render chart/table markup as a visual block');
assert(visibleTextApi.renderBlocks('![Congress](img/events/dnvp_congress.png)', {assetBaseUrl: 'file:///project'}).includes('file:///project/img/events/dnvp_congress.png'), 'Visible Text Renderer should resolve safe image asset references when an asset base is available');
assert(!visibleTextApi.renderInline('<script>alert(1)</script>').includes('<script'), 'Visible Text Renderer should drop unsupported HTML tags');
assert(!visibleTextApi.renderInline('<span style="color: #c00000; background-image: url(x)">SPD</span>').includes('url('), 'Visible Text Renderer should reject unsafe CSS values');
const previewPaneHtml = previewObjectEditorApi.renderPreviewPane({
  title: 'Election Simulation',
  objectId: 'election_simulation',
  eventBody: {
    title: {id: 'title', label: 'Title', value: '<span style="color: #c00000;">**SPD**</span> result', original: '<span style="color: #c00000;">**SPD**</span> result'},
    sections: [{id: 'body', label: 'Body', value: 'Votes: [+ spd_r +]', original: 'Votes: [+ spd_r +]', visualKinds: ['chart']}],
    options: [{
      id: 'continue',
      label: 'Continue',
      targetId: 'election_simulation.result',
      target: {source: {path: 'source/scenes/events/election.scene.dry', startLine: 20, endLine: 28}},
      fields: [{id: 'option.label', label: 'Option', value: 'Continue'}],
      resultFields: [{
        id: 'result',
        label: 'Option result',
        value: 'The campaign spends [+ spd_r +] influence and moves on.',
        sectionId: 'election_simulation.result',
        textVariables: ['spd_r'],
        logicContext: {textVariables: ['spd_r']}
      }]
    }],
    metaFields: [{id: 'route_result', role: 'route', sectionId: 'election_simulation.result', value: 'next_event'}],
    assets: [{path: 'img/events/dnvp_congress.png', type: 'image', label: 'DNVP Congress', source: {path: 'source/scenes/events/election.scene.dry', line: 22}}]
  }
});
assert(previewPaneHtml.includes('style="color: #c00000"'), 'Preview Object Editor live pane should render safe HTML party colors');
assert(previewPaneHtml.includes('dendry-text-variable'), 'Preview Object Editor live pane should distinguish variable consumers');
assert(previewPaneHtml.includes('data-studio-preview-label="true"'), 'Preview Object Editor live pane should visually separate Studio text-role labels from player prose');
assert(previewPaneHtml.includes('data-object-editing-preview-options'), 'Preview Object Editor live pane should label player choice area');
assert(previewPaneHtml.includes('data-object-editing-preview-choice-result'), 'Preview Object Editor live pane should show option-result prose beneath the player choice');
assert(previewPaneHtml.includes('data-object-editing-preview-choice-impacts'), 'Preview Object Editor live pane should list choice routes, variables, and visual impacts');
assert(previewPaneHtml.includes('next_event'), 'Preview Object Editor live pane should surface follow-up routes as choice impacts');
assert(previewPaneHtml.includes('Q.spd_r'), 'Preview Object Editor live pane should surface variables consumed by choice result text');
assert(previewPaneHtml.includes('data-object-editing-preview-assets'), 'Preview Object Editor live pane should separate referenced assets from prose');
const storyboardCardHtml = storyboardCardRendererApi.renderCard({
  key: 'event:dnvp_congress',
  kind: 'event',
  title: '<span style="color: #3E88B3;">**DNVP**</span> Congress',
  body: 'A leadership vote is being held at the <span style="color: #3E88B3;">German National Peoples Party</span> congress.'
}, {x: 0, y: 0}, {selectedKey: ''});
assert(storyboardCardHtml.includes('style="color: #3E88B3"'), 'Storyboard Canvas cards should render safe HTML party colors instead of raw tags');
assert(storyboardCardHtml.includes('<strong>DNVP</strong>'), 'Storyboard Canvas card titles should preserve Markdown emphasis inside safe HTML spans');
const previewModalHtml = previewObjectEditorApi.renderModal({
  title: 'Election Simulation',
  eventBody: {
    title: {id: 'title', label: 'Title', value: 'Election Simulation', original: 'Election Simulation'},
    sections: [{id: 'body', label: 'Body', value: 'Votes: [+ spd_r +]', original: 'Votes: [+ spd_r +]'}],
    branchSections: [{
      id: 'branch',
      label: 'Conditional text: Opening',
      value: '[? if dvp_leader == "Scholz": Scholz leads. ?][? if dvp_leader == "Curtius": Curtius leads. ?]',
      conditions: ['dvp_leader == "Scholz"', 'dvp_leader == "Curtius"'],
      conditionVariables: ['dvp_leader'],
      semanticRole: 'conditional_text'
    }],
    variables: [{name: 'dvp_leader', reads: [{path: 'source/scenes/events/death.scene.dry', line: 17}], writes: [{path: 'source/scenes/events/death.scene.dry', line: 6}]}],
    backgroundEffects: [{variable: 'dvp_leader', op: 'writes', source: {path: 'source/scenes/events/death.scene.dry', line: 6}}],
    options: []
  }
});
assert(previewModalHtml.includes('data-object-canvas-original'), 'Preview Object Editor fields should carry source originals for stable live value collection');
assert(previewModalHtml.includes('data-preview-object-field-label="true"'), 'Preview Object Editor field labels should be explicit UI chrome, not player prose');
assert(previewModalHtml.includes('data-preview-object-field-rendered'), 'Preview Object Editor should render a readable field mirror for rich text fields');
assert(previewModalHtml.includes('data-preview-object-variable-context'), 'Preview Object Editor should surface state variables beside visible text');
assert(previewModalHtml.includes('data-preview-object-background-effects'), 'Preview Object Editor should surface readonly background writes');
assert(previewModalHtml.includes('condition reads'), 'Preview Object Editor should label variables consumed by conditional text');
assert(contentStoryboardSurface.includes('data-object-editor-launch-card'), 'Content Storyboard should launch the Object Editor modal instead of embedding fields in Canvas');
assert(contentStoryboardSurface.includes('data-content-storyboard-card'), 'Content Storyboard surface should render story cards');
assert(contentStoryboardSurface.includes('data-preview-text-replacement-surface'), 'Text Replacement should use a dedicated non-timeline surface');
assert(contentStoryboardSurface.includes('data-content-storyboard-insert'), 'Content Storyboard surface should render insertion affordances');
assert(contentStoryboardSurface.includes('data-content-storyboard-plan'), 'Content Storyboard should keep plan details in the editor panel');
assert(contentStoryboardSurface.includes('delete_current_object'), 'Content Storyboard should expose an existing-object delete action');
assert(contentStoryboardSurface.includes('renderRuntimeLens'), 'Content Storyboard should render the Runtime Lens panel in the editor');
assert(storyboardScopeControls.includes('data-content-storyboard-scope'), 'Storyboard scope controls should expose scope controls');
assert(storyboardScopeControls.includes('data-content-storyboard-depth-controls'), 'Storyboard scope controls should expose chain depth controls');
assert(storyboardCardRenderer.includes('data-storyboard-card-face'), 'Storyboard card renderer should render player-facing cards');
assert(!storyboardCardRenderer.includes('data-object-canvas-field'), 'Storyboard cards should not render inline editable object fields');
assert(storyboardCardRenderer.includes('data-storyboard-card-color-picker'), 'Storyboard card renderer should expose card edge color controls');
assert(storyboardCardRenderer.includes('discard_draft_card'), 'Storyboard card renderer should expose safe draft discard controls');
assert(canvasUi.includes('project_state_delete_selected'), 'Project State workflow should expose selected-variable deletion');
assert(canvasUi.includes('existing_scene_delete'), 'Object Canvas should model existing scene delete proposals');
assert(storyboardPaletteSidebar.includes('ProjectMapStoryboardPaletteSidebar'), 'Storyboard palette sidebar should expose a browser API');
assert(storyboardPaletteSidebar.includes('data-storyboard-palette'), 'Storyboard palette sidebar should expose a stable QA marker');
assert(storyboardPaletteSidebar.includes('data-storyboard-palette-item'), 'Storyboard palette sidebar should render draggable story items');
assert(storyboardWorkspaceState.includes('ProjectMapStoryboardWorkspaceState'), 'Storyboard workspace state should expose a browser API');
assert(storyboardWorkspaceState.includes('restoreContext'), 'Storyboard workspace state should restore saved context');
assert(storyboardWorkspaceState.includes('dropPaletteItem'), 'Storyboard workspace state should handle Palette drops');
assert(storyboardWorkspaceState.includes('storyCanvasCategory'), 'Storyboard workspace state should remember the selected Canvas category');
assert(storyboardWorkspaceState.includes('storySearchQuery'), 'Storyboard workspace state should remember quick search text');
assert(storyboardWorkspaceState.includes('__dmsStoryboardPaletteQueryTimer'), 'Storyboard palette search should debounce rerenders while typing');
assert(storyboardWorkspaceState.includes('focusPaletteInput'), 'Storyboard palette search should restore focus after filtering rerenders');
assert(storyboardWorkspaceState.includes('dendry-mod-studio-storyboard-card-colors-v1'), 'Storyboard workspace state should persist local card edge colors');
assert(storyboardWorkspaceState.includes('toggle_story_scope_panel') && storyboardWorkspaceState.includes('toggle_story_overview_panel'), 'Storyboard workspace state should handle scope/year collapse toggles');
assert(contentStoryboardInteractions.includes('ProjectMapContentStoryboardInteractions'), 'Content Storyboard interactions should expose a browser API');
assert(contentStoryboardInteractions.includes('onViewport'), 'Content Storyboard interactions should support background pan');
assert(contentStoryboardInteractions.includes('onCardMove'), 'Content Storyboard interactions should support card drag');
assert(contentStoryboardInteractions.includes("canvas.addEventListener('click'"), 'Content Storyboard interactions should keep a click fallback for card selection');
assert(contentStoryboardInteractions.includes('suppressClickSelect'), 'Content Storyboard click fallback should avoid double-select after pointer selection');
assert(contentStoryboardInteractions.includes("global.addEventListener('pointerup', finishPointerDrag, true)"), 'Content Storyboard card selection should finish from window pointerup capture when Electron pointer capture is unreliable');
assert(contentStoryboardInteractions.includes("if (!current.moved)"), 'Content Storyboard card clicks should select without first saving a drag position');
assert(contentStoryboardInteractions.includes('onPaletteDrop'), 'Content Storyboard interactions should support Palette drops');
assert(contentStoryboardInteractions.includes("options.onZoom(event.deltaY < 0 ? 'in' : 'out', event)"), 'Content Storyboard interactions should support mouse-wheel zoom');
assert(runtimeLensModel.includes('ProjectMapRuntimeLensModel'), 'Runtime Lens model should expose a browser API');
assert(runtimeLensUi.includes('ProjectMapRuntimeLensUi'), 'Runtime Lens UI should expose a browser API');
assert(runtimeLensUi.includes('data-runtime-lens-frame'), 'Runtime Lens UI should render an embedded frame marker');
assert(runtimeLensWorkspaceState.includes('ProjectMapRuntimeLensWorkspaceState'), 'Runtime Lens workspace state should expose a browser API');
assert(runtimeLensWorkspaceState.includes('createRuntimeLens'), 'Runtime Lens workspace state should call the desktop bridge');
assert(cardFaceEditor.includes('ProjectMapCardFaceEditor'), 'Card Face editor should expose a browser API');
assert(cardFaceEditor.includes('ProjectMapLightweightObjectPreview'), 'Card Face editor should use the lightweight Studio preview');
assert(cardFaceEditor.includes('data-object-editor-launch-card'), 'Card Face editor should launch the Object Editor modal instead of embedding editable fields');
assert(cardFaceEditor.includes('data-card-face-editor'), 'Card Face editor should expose a stable QA marker');
assert(cardBoardSurface.includes('ProjectMapCardBoardSurface'), 'Card Board surface should expose a browser API');
assert(cardBoardSurface.includes('data-card-board-surface'), 'Card Board surface should expose a stable QA marker');
assert(cardBoardSurface.includes('data-card-board-lane="'), 'Card Board surface should render lane markers');
assert(cardBoardSurface.includes('ProjectMapCardFaceEditor'), 'Card Board surface should render through the card face editor');
assert(cardBoardInteractions.includes('ProjectMapCardBoardInteractions'), 'Card Board interactions should expose a browser API');
assert(cardBoardInteractions.includes('application/x-dms-card-board'), 'Card Board interactions should support drag/drop payloads');
assert(cardWorkspaceState.includes('ProjectMapCardWorkspaceState'), 'Card Board workspace state should expose a browser API');
assert(cardWorkspaceState.includes('openFromSystemRegion'), 'Card Board workspace state should open from System UI regions');
assert(contentStoryboardSurface.includes('data-content-storyboard-floating-controls'), 'Content Storyboard zoom controls should float inside the canvas');
assert(contentStoryboardSurface.includes('data-storyboard-drop-target'), 'Content Storyboard should expose Palette drop targets');
assert(objectCanvasViewport.includes('fitContentStoryboard'), 'Object Canvas viewport helper should fit the Storyboard canvas');
assert(objectCanvasGraphStage.includes('ProjectMapObjectCanvasGraphStage'), 'Fallback Object Canvas graph stage should stay extracted from the main controller');
assert(surfaceGraphs.includes('ProjectMapAuthoringSurfaceGraphs'), 'Surface graph builders should remain available for fallback and non-content surfaces');
assert(referenceIndex.includes('contentContext'), 'Reference index should expose selected content global context');
assert(referenceIndex.includes('branchDraft'), 'Reference index should create related branch drafts');
assert(contentInteractions.includes('pointerdown'), 'Content Graph interactions should bind pointer drag behavior');
assert(contentInteractions.includes('onViewport'), 'Content Graph interactions should support background pan');
assert(canvasUi.includes('storyboardWorkspaceApi'), 'Object Canvas should delegate content templates to the Storyboard workspace state');
assert(canvasUi.includes('openRelatedEventDraft'), 'Object Canvas should open Storyboard-created events as real event drafts');
assert(canvasUi.includes('discardDraftCard'), 'Object Canvas should discard unsaved Storyboard draft cards');
assert(canvasUi.includes('runtimeLensWorkspaceApi'), 'Object Canvas should delegate Runtime Lens behavior to its workspace state helper');
assert(canvasUi.includes('cardWorkspaceApi'), 'Object Canvas should delegate Card templates to the Card Board workspace state');
assert(storyboardWorkspaceState.includes('ProjectMapContentStoryboardSurface'), 'Storyboard workspace state should route content templates to the Storyboard surface');
assert(contentStoryboardSurface.includes('data-content-storyboard-view'), 'Content Storyboard surface should bind Storyboard view switching');
assert(canvasUi.includes('is-editor-overlay'), 'Object Canvas should support editor overlay mode');
assert(canvasUi.includes('is-object-authoring'), 'Object Canvas should mark Create as an anchored authoring workspace');
assert(changeTrayUi.includes('ProjectMapChangeTray'), 'Change Tray should expose a browser API');
assert(changeTrayUi.includes('ProjectMapDraftWorkspaceUi'), 'Change Tray should summarize saved drafts from the draft workspace');
assert(changeTrayUi.includes("openTemplate('surface'"), 'Change Tray should keep Text Patch available as a tool entry');
assert(createStyle.includes('.change-tray-toggle'), 'Create styles should include the floating Change Tray toggle');
assert(createStyle.includes('.draft-workspace-panel.change-tray-panel'), 'Draft workspace should be styled as a floating tray');
assert(installPreviewStyle.includes('.create-workspace.is-object-authoring'), 'Create workspace should avoid page-flow scrolling when Object Canvas is active');
assert(installPreviewStyle.includes('overscroll-behavior: contain'), 'Object Canvas should scroll inside the Create editing pane, not the whole app shell');
assert(createStyle.includes('.create-workspace.is-object-authoring .authoring-workspace-nav'), 'Create object-authoring navigation should use a compact top layout');
assert(editingStyle.includes('.create-workspace.is-object-authoring .editing-workspace-header'), 'Object Canvas header should use a compact editing summary in Create');
assert(editingStyle.includes('.editing-workspace-header.is-collapsed'), 'Object Canvas header should be collapsible to save board space');
assert(editingStyle.includes('.object-canvas.is-board-chrome-collapsed .object-canvas-stage-toolbar'), 'Object Canvas board toolbar should collapse its detail text');
assert(cardBoardStyle.includes('.create-workspace.is-object-authoring .card-board-workspace'), 'Card Board should shrink into the Create editing pane');
assert(cardBoardStyle.includes('.card-board-canvas') && cardBoardStyle.includes('overflow: auto'), 'Card Board canvas should keep its own scroll area');
assert(editingStyle.includes('.create-workspace.is-object-authoring .project-state-layout'), 'Project State should shrink into the Create editing pane');
assert(editingStyle.includes('.create-workspace.is-object-authoring .system-ui-layout'), 'System UI should shrink into the Create editing pane');
assert(editingStyle.includes('.lightweight-object-preview'), 'Editing styles should include the lightweight object preview surface');
assert(editingStyle.includes('.content-storyboard-search'), 'Editing styles should include the Storyboard search control');
assert(editingStyle.includes('.content-storyboard-card-color-tools'), 'Editing styles should include card edge color tools');
assert(harness.includes('change-tray-open'), 'Screenshot harness should cover the floating Change Tray');
assert(harness.includes('lightweight-preview-event'), 'Screenshot harness should cover lightweight Event preview');
assert(harness.includes('lightweight-preview-card'), 'Screenshot harness should cover lightweight Card preview');
assert(projectStateSurface.includes('ProjectMapProjectStateSurface'), 'Project State surface should expose a browser API');
assert(projectStateSurface.includes('data-project-state-surface'), 'Project State surface should expose a stable QA marker');
assert(projectStateSurface.includes('data-board-stage-toolbar'), 'Project State surface should join the collapsible board toolbar contract');
assert(projectStateSurface.includes('data-project-state-consumers'), 'Project State surface should render variable consumers');
assert(projectStateSurface.includes('DEFAULT_ROW_LIMIT'), 'Project State surface should avoid rendering every global variable at once');
assert(projectStateSurface.includes('data-project-state-variable-search'), 'Project State surface should expose variable search');
assert(canvasUi.includes('project_state_show_more'), 'Object Canvas should support incremental Project State variable loading');
assert(variableEditorUi.includes('VARIABLE_OPTION_LIMIT'), 'Variable Editor datalist should cap global variable options');
assert(canvasUi.includes('ProjectMapProjectStateSurface'), 'Object Canvas should route Project State templates to the dedicated surface');
assert(systemUiFixtureState.includes('fixtureList'), 'System UI fixture helper should expose fixture presets');
assert(systemUiRegionContext.includes('buildContext'), 'System UI context helper should build selected-region context');
assert(systemUiWorkspaceState.includes('draftWithContext'), 'System UI workspace state should save region/fixture context');
assert(systemUiPreviewSurface.includes('ProjectMapSystemUiPreviewSurface'), 'System UI Preview surface should expose a browser API');
assert(systemUiPreviewSurface.includes('data-system-ui-preview-surface'), 'System UI Preview surface should expose a stable QA marker');
assert(systemUiPreviewSurface.includes('data-board-stage-toolbar'), 'System UI Preview surface should join the collapsible board toolbar contract');
assert(systemUiScreenPreview.includes('data-system-ui-region'), 'System UI Screen preview should render selectable UI regions');
assert(systemUiScreenModel.includes('ProjectMapSystemUiScreenModel'), 'System UI Screen model should expose a browser API');
assert(systemUiScreenModel.includes('RECIPES'), 'System UI Screen model should map templates as recipes');
assert(systemUiScreenModel.includes('FAMILY_ORDER'), 'System UI Screen model should expose object families');
assert(systemUiScreenPreview.includes('ProjectMapSystemUiScreenPreview'), 'System UI Screen preview should expose a browser API');
assert(systemUiScreenPreview.includes('data-system-screen-shell'), 'System UI Screen preview should render the shared shell');
assert(systemUiRegionEditor.includes('data-system-ui-owner-template'), 'System UI region editor should expose owner evidence');
assert(systemUiRegionEditor.includes('data-system-ui-card-board-handoff'), 'System UI region editor should deep-link card play regions into Card Board');
assert(systemUiPreviewSurface.includes('data-system-screen-workspace'), 'System UI surface should expose the unified screen workspace marker');
assert(canvasUi.includes('ProjectMapSystemUiPreviewSurface'), 'Object Canvas should route System UI templates to the dedicated surface');
assert(canvasUi.includes("key === 'system_ui_preview'") && canvasUi.includes("key === 'project_state_board'"), 'Object Canvas should allow System UI and Project State boards to collapse their chrome');
assert(canvasUi.includes('function renderContentStoryboardStage'), 'Object Canvas should render the Content Storyboard stage');
assert(workspaceUi.includes('event.stopPropagation()'), 'Authoring Workspace should isolate template clicks from legacy wizard handlers without blocking same-target observers');
assert(!workspaceUi.includes('stopImmediatePropagation'), 'Authoring Workspace should avoid broad click suppression for template routing');
assert(!workspaceUi.includes('ensureTemplateApplied') && !workspaceUi.includes('scheduleTemplateApplyCheck'), 'Authoring Workspace should not use delayed template reopening as a routing fallback');
assert(canvasUi.includes('function createModeIsActive'), 'Object Canvas should have an explicit Create-mode guard for reconciler work');
assert(canvasUi.includes('function reconcileActiveTemplate(document)') && canvasUi.includes('if (!createModeIsActive(document))'), 'Object Canvas reconciler should not reopen Create after users switch pages');
assert(canvasUi.includes('function syncTemplateButtonClick(template)') && canvasUi.includes('if (!createModeIsActive(global.document))'), 'Object Canvas scheduled template clicks should not reopen Create after users switch pages');
assert(canvasUi.includes('data-object-canvas-render-error'), 'Object Canvas should surface render failures instead of leaving stale content visible');
assert(surfaceGraphs.includes('function systemUiGraphNodes'), 'Surface graph builders should define a System UI graph');
assert(surfaceGraphs.includes('function projectStateGraphNodes'), 'Surface graph builders should define a Project State graph');
assert(contentStoryboardSurface.includes('data-content-storyboard-editor'), 'Content Storyboard should render an editor/detail panel');
assert(canvasUi.includes('data-object-canvas-zoom'), 'Object Canvas should expose zoom controls');
assert(harness.includes('data-content-storyboard-surface'), 'Screenshot harness should assert the Storyboard surface');
assert(harness.includes('content-runtime-lens-ready'), 'Screenshot harness should cover Storyboard Runtime Lens ready state');
assert(harness.includes('content-runtime-lens-expanded'), 'Screenshot harness should cover expanded Storyboard Runtime Lens');
assert(harness.includes('data-card-board-surface'), 'Screenshot harness should assert the Card Board surface');
assert(harness.includes('workspaceForTemplate'), 'Screenshot harness should verify workspace routing');

function assertStoryboardPointerSelectionBehavior() {
  const previousAdd = global.addEventListener;
  const previousRemove = global.removeEventListener;
  const windowListeners = new Map();
  global.addEventListener = (type, listener) => {
    if (!windowListeners.has(type)) {
      windowListeners.set(type, []);
    }
    windowListeners.get(type).push(listener);
  };
  global.removeEventListener = (type, listener) => {
    const list = windowListeners.get(type) || [];
    const index = list.indexOf(listener);
    if (index >= 0) {
      list.splice(index, 1);
    }
  };
  try {
    const root = new FakeStoryboardRoot();
    const canvas = root.canvas;
    const card = root.card;
    const selected = [];
    const moved = [];
    contentStoryboardInteractionsApi.bind(root, {
      getViewport: () => ({x: 0, y: 0, zoom: 1}),
      onSelect: (key) => selected.push(key),
      onCardMove: (key, x, y, options) => moved.push({key, x, y, preview: Boolean(options && options.preview)})
    });
    canvas.emit('pointerdown', pointerEvent(card, 100, 120));
    emitWindow('pointerup', pointerEvent(card, 100, 120));
    assert(selected.length === 1 && selected[0] === 'event:generic_intro', 'Storyboard pointer click should select the card from window pointerup capture');
    assert(moved.length === 0, 'Storyboard pointer click should not save a drag position before selection');

    selected.length = 0;
    moved.length = 0;
    canvas.emit('pointerdown', pointerEvent(card, 100, 120));
    canvas.emit('pointermove', pointerEvent(card, 130, 150));
    emitWindow('pointerup', pointerEvent(card, 130, 150));
    assert(!selected.length, 'Storyboard drag should not open the object editor as a click');
    assert(moved.some((row) => row.key === 'event:generic_intro' && row.preview === false), 'Storyboard drag should still save the final card position');
  } finally {
    if (previousAdd) {
      global.addEventListener = previousAdd;
    } else {
      delete global.addEventListener;
    }
    if (previousRemove) {
      global.removeEventListener = previousRemove;
    } else {
      delete global.removeEventListener;
    }
  }

  function emitWindow(type, event) {
    (windowListeners.get(type) || []).slice().forEach((listener) => listener(event));
  }
}

class FakeStoryboardRoot {
  constructor() {
    this.canvas = new FakeStoryboardElement('canvas');
    this.card = new FakeStoryboardElement('card');
    this.card.parent = this.canvas;
    this.card.dataset.contentStoryboardCard = 'event:generic_intro';
    this.card.dataset.objectCanvasGraphNode = 'event:generic_intro';
    this.card.dataset.canvasX = '80';
    this.card.dataset.canvasY = '90';
    this.card.offsetLeft = 80;
    this.card.offsetTop = 90;
  }

  querySelector(selector) {
    return selector === '[data-content-storyboard-canvas]' ? this.canvas : null;
  }
}

class FakeStoryboardElement {
  constructor(kind) {
    this.kind = kind;
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this.offsetLeft = 0;
    this.offsetTop = 0;
  }

  addEventListener(type, listener) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  emit(type, event) {
    const next = Object.assign({type, target: this}, event || {});
    (this.listeners[type] || []).slice().forEach((listener) => listener(next));
  }

  setPointerCapture() {}

  releasePointerCapture() {}

  closest(selector) {
    if (selector.indexOf('[data-content-storyboard-card]') >= 0 && this.dataset.contentStoryboardCard) {
      return this;
    }
    return null;
  }
}

function pointerEvent(target, clientX, clientY) {
  return {
    target,
    button: 0,
    buttons: 1,
    pointerId: 11,
    clientX,
    clientY,
    preventDefault() {}
  };
}

assertStoryboardPointerSelectionBehavior();

process.stdout.write(JSON.stringify({ok: true, workspaces, groupedTemplates}, null, 2) + '\n');
