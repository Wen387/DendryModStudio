#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const routeStatePath = path.join(ROOT, 'authoring', 'route_state_model.js');
const routeScriptPath = path.join(ROOT, 'authoring', 'route_script_intelligence_model.js');
const semanticLogicPath = path.join(ROOT, 'authoring', 'semantic_logic_editor_model.js');
const eventWorkbenchPath = path.join(ROOT, 'authoring', 'event_workbench_model.js');
const dynamicWorkbenchPath = path.join(ROOT, 'authoring', 'dynamic_semantic_workbench_model.js');
const assetContractsPath = path.join(ROOT, 'authoring', 'asset_contract_model.js');
const assetModelPath = path.join(ROOT, 'authoring', 'asset_model.js');
const installContractsPath = path.join(ROOT, 'authoring', 'install_operation_contracts.js');
const existingSceneLineCoalescerPath = path.join(ROOT, 'authoring', 'existing_scene_line_coalescer.js');
const existingSceneLogicFieldsPath = path.join(ROOT, 'authoring', 'existing_scene_logic_fields.js');
const existingSceneStructureOperationsPath = path.join(ROOT, 'authoring', 'existing_scene_structure_operations.js');
const existingSceneTextBlockHelpersPath = path.join(ROOT, 'authoring', 'existing_scene_text_block_helpers.js');
const eventStructurePath = path.join(ROOT, 'authoring', 'event_structure_model.js');
const eventStructureEffectPath = path.join(ROOT, 'authoring', 'event_structure_effect_model.js');
const eventStructureCommandPath = path.join(ROOT, 'authoring', 'event_structure_command_model.js');
const eventStructureEffectSourceHelpersPath = path.join(ROOT, 'authoring', 'event_structure_effect_source_helpers.js');
const predicateConditionPath = path.join(ROOT, 'authoring', 'predicate_condition_model.js');
const routeRuntimeTrialPath = path.join(ROOT, 'authoring', 'route_runtime_trial_model.js');
const routeRuntimeSemanticsPath = path.join(ROOT, 'authoring', 'route_runtime_semantics_model.js');
const routeSemanticsAuditPath = path.join(ROOT, 'qa', 'route_semantics_audit.js');
const authoringDependencyLoaderPath = path.join(ROOT, 'authoring', 'authoring_dependency_loader.js');
const installReviewStatePath = path.join(ROOT, 'viewer', 'install_review_state_model.js');
const installResultReportPath = path.join(ROOT, 'viewer', 'install_result_report_model.js');
const installPlanPath = path.join(ROOT, 'authoring', 'install_plan.js');
const viewerIndexPath = path.join(ROOT, 'viewer', 'index.html');
const typesPath = path.join(ROOT, 'types', 'project_map_contracts.d.ts');
const tsconfigPath = path.join(ROOT, 'tsconfig.json');
const packagePath = path.join(ROOT, '..', '..', 'package.json');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const routeState = fs.readFileSync(routeStatePath, 'utf8');
const routeScript = fs.readFileSync(routeScriptPath, 'utf8');
const semanticLogic = fs.readFileSync(semanticLogicPath, 'utf8');
const eventWorkbench = fs.readFileSync(eventWorkbenchPath, 'utf8');
const dynamicWorkbench = fs.readFileSync(dynamicWorkbenchPath, 'utf8');
const assetContracts = fs.readFileSync(assetContractsPath, 'utf8');
const assetModel = fs.readFileSync(assetModelPath, 'utf8');
const installContracts = fs.readFileSync(installContractsPath, 'utf8');
const existingSceneLineCoalescer = fs.readFileSync(existingSceneLineCoalescerPath, 'utf8');
const existingSceneLogicFields = fs.readFileSync(existingSceneLogicFieldsPath, 'utf8');
const existingSceneStructureOperations = fs.readFileSync(existingSceneStructureOperationsPath, 'utf8');
const existingSceneTextBlockHelpers = fs.readFileSync(existingSceneTextBlockHelpersPath, 'utf8');
const eventStructure = fs.readFileSync(eventStructurePath, 'utf8');
const eventStructureEffect = fs.readFileSync(eventStructureEffectPath, 'utf8');
const eventStructureCommand = fs.readFileSync(eventStructureCommandPath, 'utf8');
const eventStructureEffectSourceHelpers = fs.readFileSync(eventStructureEffectSourceHelpersPath, 'utf8');
const predicateCondition = fs.readFileSync(predicateConditionPath, 'utf8');
const routeRuntimeTrial = fs.readFileSync(routeRuntimeTrialPath, 'utf8');
const routeRuntimeSemantics = fs.readFileSync(routeRuntimeSemanticsPath, 'utf8');
const routeSemanticsAudit = fs.readFileSync(routeSemanticsAuditPath, 'utf8');
const authoringDependencyLoader = fs.readFileSync(authoringDependencyLoaderPath, 'utf8');
const installReviewState = fs.readFileSync(installReviewStatePath, 'utf8');
const installResultReport = fs.readFileSync(installResultReportPath, 'utf8');
const installPlan = fs.readFileSync(installPlanPath, 'utf8');
const viewerIndex = fs.readFileSync(viewerIndexPath, 'utf8');
const types = fs.readFileSync(typesPath, 'utf8');
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

function hasTypeBoundary(name) {
  return types.includes('interface ' + name) || types.includes('type ' + name);
}

function normalizeViewerScriptPath(src) {
  const value = String(src || '').trim();
  if (!value || /^(?:https?:|file:|data:)/i.test(value)) {
    return '';
  }
  if (value.startsWith('../')) {
    return value.replace(/^\.\.\//, '');
  }
  if (value.startsWith('./')) {
    return 'viewer/' + value.replace(/^\.\//, '');
  }
  if (value.startsWith('authoring/') || value.startsWith('viewer/')) {
    return value;
  }
  return 'viewer/' + value;
}

function scriptPathsFromHtml(html) {
  return Array.from(String(html || '').matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/g))
    .map((match) => normalizeViewerScriptPath(match[1]))
    .filter(Boolean);
}

function scriptPathsFromLoader(loaderSource) {
  return Array.from(String(loaderSource || '').matchAll(/['"]([^'"]+\.js)['"]/g))
    .map((match) => normalizeViewerScriptPath(match[1]))
    .filter(Boolean);
}

function sourceForProjectPath(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function isRuntimeTypedIsland(relPath) {
  if (!/^(?:authoring|viewer)\//.test(String(relPath || ''))) {
    return false;
  }
  return sourceForProjectPath(relPath).startsWith('// @ts-check');
}

const runtimeTypedLoadStrategy = Object.freeze({
  'authoring/authoring_dependency_loader.js': 'direct_loader_entry',
  'authoring/asset_contract_model.js': 'loader',
  'authoring/install_operation_contracts.js': 'loader',
  'authoring/existing_scene_line_coalescer.js': 'loader',
  'authoring/existing_scene_logic_fields.js': 'direct',
  'authoring/existing_scene_structure_operations.js': 'loader',
  'authoring/existing_scene_text_block_helpers.js': 'direct',
  'authoring/event_structure_effect_model.js': 'loader',
  'authoring/event_structure_command_model.js': 'loader',
  'authoring/event_structure_effect_source_helpers.js': 'direct',
  'authoring/predicate_condition_model.js': 'loader',
  'authoring/route_runtime_trial_model.js': 'loader',
  'authoring/route_runtime_semantics_model.js': 'loader',
  'authoring/route_state_model.js': 'loader',
  'authoring/route_script_intelligence_model.js': 'loader',
  'viewer/install_review_state_model.js': 'loader',
  'viewer/install_result_report_model.js': 'loader',
  'authoring/semantic_logic_editor_model.js': 'direct',
  'authoring/event_workbench_model.js': 'direct',
  'authoring/dynamic_semantic_workbench_model.js': 'direct'
});

[
  'ProjectIndex',
  'RouteStateModel',
  'RouteState',
  'RouteCandidate',
  'ConditionState',
  'PredicateSummary',
  'ProjectIndexScene',
  'ProjectIndexSection',
  'ProjectIndexEdge',
  'SourceRef',
  'DiagnosticRow',
  'RouteScriptIntelligenceModel',
  'RouteEvidenceMap',
  'RouteEvidenceItem',
  'ScriptImpactMap',
  'ScriptImpactBlock',
  'GuidedScriptEdit',
  'SemanticLogicEditorModel',
  'SemanticLogicProposal',
  'SemanticEditorEvidence',
  'SemanticFieldControl',
  'EventWorkbenchModel',
  'DynamicSemanticWorkbenchModel',
  'InstallPlan',
  'InstallPlanOperation',
  'InstallOperationType',
  'InstallSafety',
  'InstallOperationTarget',
  'SourceEvidence',
  'TextOperationEvidence',
  'AssetOperationEvidence',
  'InstallPreflightResult',
  'InstallApplyResult',
  'InstallOperationSummary',
  'ReviewApplyReadiness',
  'ReviewApplyStep',
  'ReviewApplyUiState',
  'InstallReviewStateModelApi',
  'InstallResultReportOptions',
  'InstallResultReportModelApi',
  'AssetSlotDefinition',
  'AssetInstallRequest',
  'AssetContractModelApi',
  'ExistingSceneTextBlockHelpersApi',
  'ExistingSceneTextBlockHelpersFactory',
  'ExistingSceneTextBlockRow',
  'ExistingSceneOptionRow',
  'ExistingSceneTextBlockSemantics',
  'ExistingSceneConditionalAlternative',
  'ExistingSceneStructureOperationsApi',
  'ExistingSceneStructureOperationsFactory',
  'ExistingSceneStructureOperationSummary',
  'EventStructureEffect',
  'EventStructureEffectConditionSplit',
  'EventStructureEffectModelApi',
  'EventStructureEffectSourceRemoval',
  'EventStructureEffectSourceHelpersApi',
  'EventStructureCommand',
  'EventStructureCommandModelApi',
  'ExistingSceneLogicFieldsApi',
  'ExistingSceneLogicField',
  'ExistingSceneLogicFieldChange',
  'EditAction',
  'PredicateConditionModelApi',
  'RouteRuntimeTrialModelApi',
  'RouteRuntimeSemanticsApi'
].forEach((name) => {
  assert(hasTypeBoundary(name), 'typed boundary should define ' + name);
});

assert(routeState.includes("import('../types/project_map_contracts').RouteStateModel"), 'route_state_model should reference RouteStateModel typedef');
assert(routeState.includes("import('../types/project_map_contracts').PredicateSummary"), 'route_state_model should reference PredicateSummary typedef');
assert(routeScript.includes("import('../types/project_map_contracts').RouteScriptIntelligenceModel"), 'route_script_intelligence_model should reference RouteScriptIntelligenceModel typedef');
assert(semanticLogic.includes("import('../types/project_map_contracts').SemanticLogicEditorModel"), 'semantic_logic_editor_model should reference SemanticLogicEditorModel typedef');
assert(eventWorkbench.includes("import('../types/project_map_contracts').EventWorkbenchModel"), 'event_workbench_model should reference EventWorkbenchModel typedef');
assert(dynamicWorkbench.includes("import('../types/project_map_contracts').DynamicSemanticWorkbenchModel"), 'dynamic_semantic_workbench_model should reference DynamicSemanticWorkbenchModel typedef');
assert(installContracts.includes("import('../types/project_map_contracts').InstallPlanOperation"), 'install_operation_contracts should reference InstallPlanOperation typedef');
assert(installPlan.includes('installOperationContracts.normalizeInstallOperation'), 'install_plan should delegate operation normalization to typed contracts');
assert(installPlan.includes('installOperationContracts.summarizeInstallOperations'), 'install_plan should delegate operation summary to typed contracts');
assert(installPlan.includes('installOperationContracts.renderPatchPreview'), 'install_plan should delegate patch preview rendering to typed contracts');
assert(installPlan.includes('installOperationContracts.withOperationEvidence'), 'install_plan should delegate evidence result attachment to typed contracts');
assert(installPlan.includes('existingSceneLineCoalescer.coalesceExistingSceneLineReplacements'), 'install_plan should delegate same-line coalescing to focused helper');
assert(assetContracts.includes("import('../types/project_map_contracts').AssetContractModelApi"), 'asset_contract_model should reference AssetContractModelApi typedef');
assert(assetModel.includes('ProjectMapAssetContractModel') && assetModel.includes('assetContracts().assetInstallRequest'), 'asset_model should delegate install request shaping to typed asset contracts');
assert(existingSceneLogicFields.includes("import('../types/project_map_contracts').ExistingSceneLogicFieldsApi"), 'existing_scene_logic_fields should reference ExistingSceneLogicFieldsApi typedef');
assert(existingSceneStructureOperations.includes("import('../types/project_map_contracts').ExistingSceneStructureOperationsApi"), 'existing_scene_structure_operations should reference ExistingSceneStructureOperationsApi typedef');
assert(existingSceneStructureOperations.includes('classifyChange') && existingSceneStructureOperations.includes('structureActionFallbackText'), 'existing_scene_structure_operations should own structural change classification and fallback text');
assert(existingSceneTextBlockHelpers.includes("import('../types/project_map_contracts').ExistingSceneTextBlockHelpersApi"), 'existing_scene_text_block_helpers should reference ExistingSceneTextBlockHelpersApi typedef');
assert(existingSceneTextBlockHelpers.includes("import('../types/project_map_contracts').ExistingSceneTextBlockSemantics"), 'existing_scene_text_block_helpers should type semantic summary rows');
assert(eventStructureEffect.includes("import('../types/project_map_contracts').EventStructureEffectModelApi"), 'event_structure_effect_model should reference EventStructureEffectModelApi typedef');
assert(eventStructureCommand.includes("import('../types/project_map_contracts').EventStructureCommandModelApi"), 'event_structure_command_model should reference EventStructureCommandModelApi typedef');
assert(eventStructure.includes('eventCommandModel().applyCommand') && eventStructure.includes('eventCommandModel().commandsFromValues'), 'event_structure_model should delegate command application and parsing to typed command model');
assert(eventStructureEffectSourceHelpers.includes("import('../types/project_map_contracts').EventStructureEffectSourceHelpersApi"), 'event_structure_effect_source_helpers should reference EventStructureEffectSourceHelpersApi typedef');
assert(installReviewState.includes("import('../types/project_map_contracts').ReviewApplyUiState"), 'install_review_state_model should reference ReviewApplyUiState typedef');
assert(installResultReport.includes("import('../types/project_map_contracts').InstallResultReportOptions"), 'install_result_report_model should reference InstallResultReportOptions typedef');
assert(predicateCondition.includes("import('../types/project_map_contracts').PredicateSummary"), 'predicate_condition_model should reference PredicateSummary typedef');
assert(routeState.includes('predicateModel.summarizePredicate') && routeState.includes('predicateModel.predicateDependencies'), 'route_state_model should delegate predicate parsing to focused helper');
assert(routeRuntimeTrial.includes("import('../types/project_map_contracts').RouteRuntimeSemantics"), 'route_runtime_trial_model should reference RouteRuntimeSemantics typedef');
assert(routeRuntimeTrial.includes("import('../types/project_map_contracts').RouteCollisionSummary"), 'route_runtime_trial_model should reference RouteCollisionSummary typedef');
assert(routeRuntimeSemantics.includes("import('../types/project_map_contracts').RouteRuntimeSemantics"), 'route_runtime_semantics_model should reference RouteRuntimeSemantics typedef');
assert(routeState.includes('.routeRuntimeSemantics(state, candidates'), 'route_state_model should delegate runtime route selection semantics to focused helper');
assert(routeSemanticsAudit.includes('modelCollisionCoverageFor'), 'route semantics audit should expose model collision coverage reconciliation');
assert(routeSemanticsAudit.includes('Missing Compiled Route Groups'), 'route semantics audit report should show missing compiled route groups explicitly');
assert(authoringDependencyLoader.includes('asset_contract_model.js') && authoringDependencyLoader.includes('install_operation_contracts.js') && authoringDependencyLoader.includes('existing_scene_line_coalescer.js') && authoringDependencyLoader.includes('existing_scene_structure_operations.js') && authoringDependencyLoader.includes('event_structure_effect_model.js') && authoringDependencyLoader.includes('event_structure_command_model.js') && authoringDependencyLoader.includes('predicate_condition_model.js') && authoringDependencyLoader.includes('route_runtime_trial_model.js') && authoringDependencyLoader.includes('route_runtime_semantics_model.js') && authoringDependencyLoader.includes('route_state_model.js') && authoringDependencyLoader.includes('route_script_intelligence_model.js') && authoringDependencyLoader.includes('install_review_state_model.js') && authoringDependencyLoader.includes('install_result_report_model.js'), 'authoring dependency loader should list typed island dependencies');
assert(authoringDependencyLoader.indexOf('asset_contract_model.js') < authoringDependencyLoader.indexOf('install_operation_contracts.js'), 'asset contracts should load before authoring models that consume asset install shapes');
assert(authoringDependencyLoader.indexOf('existing_scene_structure_operations.js') < authoringDependencyLoader.indexOf('route_state_model.js'), 'existing scene structure operations should load with early authoring helpers');
assert(authoringDependencyLoader.indexOf('event_structure_effect_model.js') < authoringDependencyLoader.indexOf('route_state_model.js'), 'event structure effect helper should load with early authoring helpers');
assert(authoringDependencyLoader.indexOf('event_structure_effect_model.js') < authoringDependencyLoader.indexOf('event_structure_command_model.js'), 'event structure effect helper should load before command model');
assert(authoringDependencyLoader.indexOf('predicate_condition_model.js') < authoringDependencyLoader.indexOf('route_state_model.js'), 'predicate helper should load before route_state_model');
assert(authoringDependencyLoader.indexOf('route_runtime_semantics_model.js') < authoringDependencyLoader.indexOf('route_state_model.js'), 'route runtime semantics helper should load before route_state_model');
assert(viewerIndex.indexOf('authoring_dependency_loader.js') >= 0 && viewerIndex.indexOf('authoring_dependency_loader.js') < viewerIndex.indexOf('install_plan.js'), 'viewer should load authoring dependencies before install_plan');
const indexScriptPaths = scriptPathsFromHtml(viewerIndex);
const loaderScriptPaths = scriptPathsFromLoader(authoringDependencyLoader);
const tsconfigRuntimeTypedIncludes = tsconfig.include.filter((relPath) => /\.js$/.test(relPath) && isRuntimeTypedIsland(relPath));
const indexScriptSet = new Set(indexScriptPaths);
const loaderScriptSet = new Set(loaderScriptPaths);
const strategyFiles = Object.keys(runtimeTypedLoadStrategy);
tsconfigRuntimeTypedIncludes.forEach((relPath) => {
  assert(runtimeTypedLoadStrategy[relPath], 'runtime typed island should have an explicit loader strategy: ' + relPath);
});
strategyFiles.forEach((relPath) => {
  assert(tsconfigRuntimeTypedIncludes.includes(relPath), 'typed-island load strategy should stay compiler checked: ' + relPath);
  const strategy = runtimeTypedLoadStrategy[relPath];
  if (strategy === 'loader') {
    assert(loaderScriptSet.has(relPath), 'loader-managed typed island should be listed in authoring_dependency_loader.js: ' + relPath);
    assert(!indexScriptSet.has(relPath), 'loader-managed typed island should not be loaded again from viewer/index.html: ' + relPath);
  } else if (strategy === 'direct') {
    assert(indexScriptSet.has(relPath), 'direct typed island should have an explicit viewer/index.html script: ' + relPath);
    assert(!loaderScriptSet.has(relPath), 'direct typed island should not also be pulled through the typed-island loader: ' + relPath);
  } else if (strategy === 'direct_loader_entry') {
    assert(indexScriptSet.has(relPath), 'typed-island loader entry should be loaded from viewer/index.html: ' + relPath);
  }
});
assert(loaderScriptSet.has('authoring/protected_path_policy.js'), 'typed-island loader should keep protected path policy before install contracts');
assert(loaderScriptPaths.indexOf('authoring/protected_path_policy.js') < loaderScriptPaths.indexOf('authoring/install_operation_contracts.js'), 'protected path policy should load before install operation contracts');
assert(loaderScriptSet.has('authoring/existing_scene_structure_operations.js') && viewerIndex.indexOf('authoring_dependency_loader.js') < viewerIndex.indexOf('existing_scene_edit_model.js'), 'existing scene structure operations should load through the typed-island loader before existing scene edit model');
const accidentalDirectTypedLoads = tsconfigRuntimeTypedIncludes.filter((relPath) => {
  return indexScriptSet.has(relPath) && runtimeTypedLoadStrategy[relPath] === 'loader';
});
assert(!accidentalDirectTypedLoads.length, 'loader-managed typed islands should not regress into scattered script tags: ' + accidentalDirectTypedLoads.join(', '));
[routeState, routeScript, semanticLogic, eventWorkbench, dynamicWorkbench, assetContracts, installContracts, existingSceneLineCoalescer, existingSceneLogicFields, existingSceneStructureOperations, existingSceneTextBlockHelpers, eventStructureEffect, eventStructureCommand, eventStructureEffectSourceHelpers, predicateCondition, routeRuntimeTrial, routeRuntimeSemantics, authoringDependencyLoader, installReviewState, installResultReport].forEach((content) => {
  assert(content.startsWith('// @ts-check'), 'typed island files should opt in to @ts-check');
});
assert(String(packageJson.scripts && packageJson.scripts['check:types'] || '').includes('tsc -p tools/project_map/tsconfig.json'), 'check:types should run the TypeScript compiler');
assert(packageJson.devDependencies && packageJson.devDependencies.typescript, 'typescript should be a devDependency');
assert(packageJson.devDependencies && packageJson.devDependencies['@types/node'], '@types/node should be a devDependency');
assert(tsconfig.compilerOptions && tsconfig.compilerOptions.allowJs === true, 'tsconfig should allow JS for gradual migration');
assert(tsconfig.compilerOptions && tsconfig.compilerOptions.noEmit === true, 'tsconfig should be noEmit');
assert(tsconfig.compilerOptions && tsconfig.compilerOptions.moduleResolution === 'node', 'tsconfig should resolve CommonJS modules through node resolution');
assert(Array.isArray(tsconfig.compilerOptions.lib) && tsconfig.compilerOptions.lib.includes('DOM'), 'tsconfig should include DOM globals for browser bridges');
assert(Array.isArray(tsconfig.compilerOptions.types) && tsconfig.compilerOptions.types.includes('node'), 'tsconfig should include node globals for checks');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/route_state_model.js'), 'tsconfig should include the route-state island');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/route_script_intelligence_model.js'), 'tsconfig should include route-script intelligence');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/semantic_logic_editor_model.js'), 'tsconfig should include semantic logic editor');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/event_workbench_model.js'), 'tsconfig should include Event Workbench adapter');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/dynamic_semantic_workbench_model.js'), 'tsconfig should include Dynamic Semantic Workbench adapter');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/asset_contract_model.js'), 'tsconfig should include asset contracts');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/install_operation_contracts.js'), 'tsconfig should include install operation contracts');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/existing_scene_line_coalescer.js'), 'tsconfig should include existing scene line coalescer');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/existing_scene_logic_fields.js'), 'tsconfig should include existing scene logic fields');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/existing_scene_structure_operations.js'), 'tsconfig should include existing scene structure operations');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/existing_scene_text_block_helpers.js'), 'tsconfig should include existing scene text block helpers');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/event_structure_effect_model.js'), 'tsconfig should include event structure effect model');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/event_structure_command_model.js'), 'tsconfig should include event structure command model');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/event_structure_effect_source_helpers.js'), 'tsconfig should include event structure effect source helpers');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/predicate_condition_model.js'), 'tsconfig should include predicate condition model');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/route_runtime_trial_model.js'), 'tsconfig should include route runtime trial model');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/route_runtime_semantics_model.js'), 'tsconfig should include route runtime semantics model');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('qa/route_semantics_audit.js'), 'tsconfig should include route semantics audit');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('authoring/authoring_dependency_loader.js'), 'tsconfig should include authoring dependency loader');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('viewer/install_review_state_model.js'), 'tsconfig should include install review state model');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('viewer/install_result_report_model.js'), 'tsconfig should include install result report model');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('apply_install_plan.js'), 'tsconfig should include install plan CLI reader');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('check_asset_contract_model.js'), 'tsconfig should include asset contract focused check');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('check_route_state_model.js'), 'tsconfig should include route-state focused check');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('check_route_semantics_audit_model.js'), 'tsconfig should include route semantics audit focused check');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('check_predicate_dependency_model.js'), 'tsconfig should include predicate focused check');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('check_route_script_intelligence_model.js'), 'tsconfig should include route-script focused check');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('check_semantic_logic_editor_model.js'), 'tsconfig should include semantic-logic focused check');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('check_dynamic_semantic_workbench_model.js'), 'tsconfig should include dynamic semantic focused check');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('check_install_operation_contracts_model.js'), 'tsconfig should include install operation contracts focused check');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('check_install_plan_model.js'), 'tsconfig should include install plan focused check');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('check_install_review_ui_model.js'), 'tsconfig should include install review UI focused check');
assert(Array.isArray(tsconfig.include) && tsconfig.include.includes('types/**/*.d.ts'), 'tsconfig should include typed contracts');

process.stdout.write(JSON.stringify({
  ok: true,
  contracts: 56,
  typeCheckPath: 'tools/project_map/tsconfig.json',
  note: 'check:types now runs tsc --noEmit before this contract sanity check.'
}, null, 2) + '\n');
