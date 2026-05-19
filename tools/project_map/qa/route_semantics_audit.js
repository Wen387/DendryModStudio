#!/usr/bin/env node
// @ts-check
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const routeStateModel = require('../authoring/route_state_model.js');

const PROJECT_MAP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PROJECT_MAP_ROOT, '..', '..');
const DEFAULT_ROOT = path.join(REPO_ROOT, 'SDAAHdynamic', 'dynamic_social_democracy-main');
const DEFAULT_SAMPLE_LIMIT = 512;

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(args.root || DEFAULT_ROOT);
  const sampleLimit = Number(args.sampleLimit || DEFAULT_SAMPLE_LIMIT) || DEFAULT_SAMPLE_LIMIT;
  const indexPath = args.index ? path.resolve(args.index) : buildIndex(projectRoot, args);
  const gamePath = path.resolve(args.gameJson || path.join(projectRoot, 'out', 'game.json'));
  const index = readJson(indexPath);
  const game = fs.existsSync(gamePath) ? readJson(gamePath) : {scenes: {}};
  const report = buildReport({index, game, indexPath, gamePath, projectRoot, sampleLimit});

  if (args.jsonOut) {
    writeFile(path.resolve(args.jsonOut), JSON.stringify(report, null, 2) + '\n');
  }
  if (args.markdownOut) {
    writeFile(path.resolve(args.markdownOut), renderMarkdown(report));
  }
  process.stdout.write(JSON.stringify({
    ok: true,
    indexPath,
    gamePath: fs.existsSync(gamePath) ? gamePath : '',
    summary: report.summary,
    highPriorityGapCount: report.gaps.filter((gap) => gap.priority === 'high').length
  }, null, 2) + '\n');
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') out.root = argv[++index];
    else if (arg === '--index') out.index = argv[++index];
    else if (arg === '--game-json') out.gameJson = argv[++index];
    else if (arg === '--json-out') out.jsonOut = argv[++index];
    else if (arg === '--markdown-out') out.markdownOut = argv[++index];
    else if (arg === '--sample-limit') out.sampleLimit = argv[++index];
    else if (arg === '--include-excerpts') out.includeExcerpts = true;
    else if (arg === '--help' || arg === '-h') {
      process.stdout.write([
        'Usage: node tools/project_map/qa/route_semantics_audit.js [options]',
        '',
        'Options:',
        '  --root PATH          Project root. Defaults to SDAAHdynamic/dynamic_social_democracy-main.',
        '  --index PATH         Existing ProjectIndex JSON. If omitted, the audit builds one.',
        '  --game-json PATH     Compiled out/game.json path.',
        '  --json-out PATH      Write full JSON report.',
        '  --markdown-out PATH  Write Markdown report.',
        '  --sample-limit N     Max synthetic states per route group.',
        '  --include-excerpts   Include source excerpts when building ProjectIndex.'
      ].join('\n') + '\n');
      process.exit(0);
    }
  }
  return out;
}

function buildIndex(projectRoot, args) {
  const outPath = path.join(os.tmpdir(), 'dms_route_semantics_audit_index_' + Date.now() + '.json');
  const commandArgs = [
    path.join(PROJECT_MAP_ROOT, 'build_project_map.py'),
    '--root', projectRoot,
    '--out', outPath
  ];
  if (args.includeExcerpts) {
    commandArgs.push('--include-excerpts', '--excerpt-context-lines', '2');
  }
  const result = childProcess.spawnSync('python3', commandArgs, {encoding: 'utf8'});
  if (result.status !== 0) {
    throw new Error('ProjectIndex build failed:\n' + (result.stderr || '') + (result.stdout || ''));
  }
  return outPath;
}

function buildReport(context) {
  const routeModel = routeStateModel.buildRouteStateModel(context.index, {sampleLimit: context.sampleLimit});
  const states = routeModel.states || [];
  const stateLookup = routeStateLookup(states);
  const protectedRouteOwners = protectedRouteOwnerLookup(context.index);
  const compiledGroups = compiledRouteGroups(context.game);
  const collisions = compiledGroups
    .filter((group) => group.routeField === 'goTo' && group.candidates.length > 1)
    .map((group) => collideGroup(group, bestRouteStateForGroup(stateLookup, group), context.sampleLimit));
  const scriptRisks = compiledGroups
    .filter((group) => group.candidates.length && group.onArrivalCode)
    .map((group) => scriptRouteRisk(group, bestRouteStateForGroup(stateLookup, group)))
    .filter((risk) => risk.intersectingWrites.length || risk.opaqueScript);
  const parserCoverage = parserCoverageFor(compiledGroups, stateLookup, protectedRouteOwners);
  const modelCollisionCoverage = modelCollisionCoverageFor(collisions, stateLookup);
  const gapRows = gapsFor({routeModel, collisions, scriptRisks, parserCoverage, modelCollisionCoverage, states, compiledGroups});
  const directScriptRisks = scriptRisks.filter((risk) => risk.intersectingWrites.length);
  const opaqueOnlyScriptRisks = scriptRisks.filter((risk) => !risk.intersectingWrites.length && risk.opaqueScript);
  return {
    generatedAt: new Date().toISOString(),
    projectRoot: context.projectRoot,
    indexPath: context.indexPath,
    gamePath: context.gamePath,
    sampleLimit: context.sampleLimit,
    summary: {
      sceneCount: Object.keys(context.game.scenes || {}).length || (context.index.scenes || []).length,
      compiledRouteGroupCount: compiledGroups.length,
      compiledMultiGoToGroupCount: compiledGroups.filter((group) => group.routeField === 'goTo' && group.candidates.length > 1).length,
      routeStateCount: routeModel.summary.routeStateCount,
      routeCandidateCount: routeModel.summary.routeCandidateCount,
      possibleRandomRouteCount: routeModel.summary.possibleRandomRouteCount,
      unconditionalMixedRouteCount: routeModel.summary.unconditionalMixedRouteCount,
      explicitExclusiveRouteCount: routeModel.summary.explicitExclusiveRouteCount,
      goToRefCount: routeModel.summary.goToRefCount,
      setJumpCount: routeModel.summary.setJumpCount,
      modelPreRouteScriptCount: routeModel.summary.preRouteScriptCount || 0,
      modelPreRouteDependencyWriteCount: routeModel.summary.preRouteRouteDependencyWriteCount || 0,
      modelPreRouteOpaqueScriptCount: routeModel.summary.preRouteOpaqueScriptCount || 0,
      modelCollisionTestedRouteCount: routeModel.summary.collisionTestedRouteCount || 0,
      modelCollisionProvenMultiValidCount: routeModel.summary.collisionProvenMultiValidCount || 0,
      modelCollisionCoverageGapCount: modelCollisionCoverage.gapCount,
      collisionMultiValidCount: collisions.filter((row) => row.multiValidCount > 0).length,
      collisionZeroValidCount: collisions.filter((row) => row.zeroValidCount > 0).length,
      scriptRouteRiskCount: scriptRisks.length,
      scriptRouteDependencyRiskCount: directScriptRisks.length,
      scriptRouteOpaqueOnlyCount: opaqueOnlyScriptRisks.length,
      parserCoverageProtectedBoundaryCount: parserCoverage.protectedBoundaryCount,
      parserCoverageMissingCount: parserCoverage.missingCount,
      parserCoverageMismatchCount: parserCoverage.mismatchedCount,
      highPriorityGapCount: gapRows.filter((gap) => gap.priority === 'high').length
    },
    collisions,
    scriptRouteRisks: scriptRisks,
    parserCoverage,
    modelCollisionCoverage,
    routeStateSummary: routeModel.summary,
    sampleCases: sampleCases({collisions, scriptRisks, states, modelCollisionCoverage}),
    gaps: gapRows,
    recommendedRepairs: recommendedRepairs(gapRows)
  };
}

function routeStateLookup(states) {
  const map = new Map();
  states.forEach((state) => {
    const key = String(state.ownerId || '') + '|' + String(state.routeField || '');
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(state);
  });
  return map;
}

function protectedRouteOwnerLookup(index) {
  const owners = new Set();
  ensureArray(index && index.scenes).forEach((scene) => {
    const id = String(scene && scene.id || '');
    const type = String(scene && scene.type || '');
    const scenePath = String(scene && scene.path || '');
    if (!id) {
      return;
    }
    if (type === 'monthly_router' || scenePath === 'source/scenes/post_event.scene.dry') {
      owners.add(id);
    }
  });
  return owners;
}

function protectedRouteBoundaryFor(owners, group) {
  const ownerId = String(group && group.ownerId || '');
  const sceneId = ownerId.split('.')[0];
  return Boolean(sceneId && owners && owners.has(sceneId));
}

function bestRouteStateForGroup(stateLookup, group) {
  const states = stateLookup.get(String(group.ownerId || '') + '|' + String(group.routeField || '')) || [];
  if (!states.length) {
    return null;
  }
  const compiledTargets = group.candidates.map((candidate) => String(candidate.target || ''));
  return states.slice().sort((a, b) => {
    return routeStateScore(b, group, compiledTargets) - routeStateScore(a, group, compiledTargets);
  })[0] || null;
}

function routeStateScore(state, group, compiledTargets) {
  const candidateCount = Number(state && state.candidateCount || 0);
  const countScore = candidateCount === group.candidates.length
    ? 10000
    : 1000 - Math.abs(candidateCount - group.candidates.length);
  const parserScore = state && state.id && String(state.id).startsWith('route_order_') ? 500 : 0;
  const sourceScore = state && state.sourceRaw && String(state.sourceRaw || '').includes(';') ? 100 : 0;
  const targetScore = ensureArray(state && state.candidates).reduce((total, candidate) => {
    const target = String(candidate && (candidate.resolvedTarget || candidate.target || candidate.rawTarget) || '');
    return total + (compiledTargets.includes(target) ? 10 : compiledTargets.some((compiled) => compiled.endsWith('.' + target) || target.endsWith('.' + compiled)) ? 5 : 0);
  }, 0);
  return countScore + parserScore + sourceScore + targetScore;
}

function compiledRouteGroups(game) {
  const scenes = game && game.scenes || {};
  const rows = [];
  Object.keys(scenes).sort().forEach((id) => {
    const scene = scenes[id] || {};
    [
      ['goTo', scene.goTo],
      ['goToRef', scene.goToRef],
      ['goSub', scene.goSub],
      ['goSubStart', scene.goSubStart],
      ['goSubEnd', scene.goSubEnd]
    ].forEach(([field, list]) => {
      if (Array.isArray(list) && list.length) {
        rows.push({
          ownerId: id,
          routeField: field,
          candidates: list.map((route, index) => ({
            order: index + 1,
            target: String(route.id || ''),
            predicateCode: String(route.predicate && route.predicate.$code || ''),
            unconditional: !route.predicate
          })),
          onArrivalCode: codeList(scene.onArrival).join('\n'),
          setJump: ''
        });
      }
    });
    if (scene.setJump) {
      rows.push({
        ownerId: id,
        routeField: 'setJump',
        candidates: [{order: 1, target: String(scene.setJump || ''), predicateCode: '', unconditional: true}],
        onArrivalCode: codeList(scene.onArrival).join('\n'),
        setJump: String(scene.setJump || '')
      });
    }
  });
  return rows;
}

function collideGroup(group, state, sampleLimit) {
  const dependencies = unique([].concat(
    state && state.dependencies || [],
    group.candidates.flatMap((candidate) => variablesInCode(candidate.predicateCode))
  ));
  const domains = domainsForState(state, dependencies, group);
  const samples = sampleStates(domains, sampleLimit);
  const evaluators = group.candidates.map((candidate) => ({
    target: candidate.target,
    unconditional: candidate.unconditional,
    evaluate: predicateEvaluator(candidate.predicateCode)
  }));
  let zeroValidCount = 0;
  let oneValidCount = 0;
  let multiValidCount = 0;
  const examples = {zeroValid: [], multiValid: []};
  samples.forEach((Q) => {
    const validTargets = evaluators.filter((candidate) => candidate.unconditional || candidate.evaluate(Q)).map((candidate) => candidate.target);
    if (validTargets.length === 0) {
      zeroValidCount += 1;
      if (examples.zeroValid.length < 3) examples.zeroValid.push({state: Q, validTargets});
    } else if (validTargets.length === 1) {
      oneValidCount += 1;
    } else {
      multiValidCount += 1;
      if (examples.multiValid.length < 3) examples.multiValid.push({state: Q, validTargets});
    }
  });
  return {
    ownerId: group.ownerId,
    candidateCount: group.candidates.length,
    sampleCount: samples.length,
    dependencyCount: dependencies.length,
    dependencies,
    zeroValidCount,
    oneValidCount,
    multiValidCount,
    compiledSelection: multiValidCount ? 'proven_multi_valid_sample' : zeroValidCount ? 'has_zero_valid_sample' : 'sampled_single_valid',
    parserSelection: state && state.runtimeSemantics && state.runtimeSemantics.selectionMode || '',
    parserExclusivity: state && state.runtimeSemantics && state.runtimeSemantics.exclusivity || '',
    parserPossibleRandomization: Boolean(state && state.runtimeSemantics && state.runtimeSemantics.possibleRandomization),
    parserStatus: state && state.status || '',
    targets: group.candidates.map((candidate) => candidate.target),
    examples
  };
}

function scriptRouteRisk(group, state) {
  const routeDeps = unique([].concat(
    state && state.dependencies || [],
    group.candidates.flatMap((candidate) => variablesInCode(candidate.predicateCode))
  ));
  const writes = writeVarsFromCode(group.onArrivalCode);
  const intersectingWrites = writes.filter((name) => routeDeps.includes(name));
  const opaqueScript = /(^|\n)\s*(for|while|if|const|let|var)\b|dendryUI|document\.|this\./.test(group.onArrivalCode);
  return {
    ownerId: group.ownerId,
    routeField: group.routeField,
    routeDependencies: routeDeps,
    onArrivalWrites: writes,
    intersectingWrites,
    opaqueScript,
    reason: intersectingWrites.length
      ? 'on-arrival writes variables read by immediate route predicates'
      : 'on-arrival contains complex runtime code before route selection'
  };
}

function parserCoverageFor(compiledGroups, stateLookup, protectedRouteOwners) {
  const missing = [];
  const mismatched = [];
  const protectedBoundaries = [];
  compiledGroups.forEach((group) => {
    const state = bestRouteStateForGroup(stateLookup, group);
    const isProtected = protectedRouteBoundaryFor(protectedRouteOwners, group);
    if (!state) {
      if (isProtected) {
        protectedBoundaries.push({
          ownerId: group.ownerId,
          routeField: group.routeField,
          compiledCandidateCount: group.candidates.length,
          routeStateCandidateCount: 0,
          reason: 'ProjectIndex treats this owner as a protected router boundary.'
        });
        return;
      }
      missing.push({ownerId: group.ownerId, routeField: group.routeField, compiledCandidateCount: group.candidates.length});
      return;
    }
    if (Number(state.candidateCount || 0) !== group.candidates.length) {
      if (isProtected) {
        protectedBoundaries.push({
          ownerId: group.ownerId,
          routeField: group.routeField,
          compiledCandidateCount: group.candidates.length,
          routeStateCandidateCount: Number(state.candidateCount || 0),
          reason: 'ProjectIndex keeps protected router source as review-only edge evidence instead of editable route-order groups.'
        });
        return;
      }
      mismatched.push({
        ownerId: group.ownerId,
        routeField: group.routeField,
        compiledCandidateCount: group.candidates.length,
        routeStateCandidateCount: Number(state.candidateCount || 0)
      });
    }
  });
  return {
    checked: compiledGroups.length,
    protectedBoundaries: protectedBoundaries.slice(0, 50),
    protectedBoundaryCount: protectedBoundaries.length,
    missing: missing.slice(0, 50),
    missingCount: missing.length,
    mismatched: mismatched.slice(0, 50),
    mismatchedCount: mismatched.length
  };
}

function modelCollisionCoverageFor(collisions, stateLookup) {
  const compiledMultiValid = collisions.filter((row) => row.multiValidCount > 0);
  const missingModelProof = compiledMultiValid.map((row) => {
    const state = bestRouteStateForGroup(stateLookup, {ownerId: row.ownerId, routeField: 'goTo', candidates: row.targets.map((target) => ({target}))});
    const after = state && state.runtimeSemantics && state.runtimeSemantics.collisionSummary && state.runtimeSemantics.collisionSummary.after;
    const modelMultiValidCount = Number(after && after.multiValidCount || 0);
    const parserPossibleRandomization = Boolean(state && state.runtimeSemantics && state.runtimeSemantics.possibleRandomization);
    return {
      ownerId: row.ownerId,
      routeField: 'goTo',
      compiledMultiValidCount: row.multiValidCount,
      modelMultiValidCount,
      parserPossibleRandomization,
      parserSelection: row.parserSelection,
      parserExclusivity: row.parserExclusivity,
      targets: row.targets
    };
  }).filter((row) => row.modelMultiValidCount <= 0);
  return {
    compiledMultiValidCount: compiledMultiValid.length,
    modelProvenMultiValidCount: compiledMultiValid.length - missingModelProof.length,
    gapCount: missingModelProof.length,
    missingModelProof: missingModelProof.slice(0, 50)
  };
}

function gapsFor(input) {
  const gaps = [];
  const directScriptRiskCount = input.scriptRisks.filter((risk) => risk.intersectingWrites.length).length;
  const opaqueOnlyRiskCount = input.scriptRisks.filter((risk) => !risk.intersectingWrites.length && risk.opaqueScript).length;
  const modeledDirectScriptCount = Number(input.routeModel.summary && input.routeModel.summary.preRouteRouteDependencyWriteCount || 0);
  const modeledOpaqueScriptCount = Number(input.routeModel.summary && input.routeModel.summary.preRouteOpaqueScriptCount || 0);
  if (input.collisions.some((row) => row.multiValidCount > 0 && !row.parserPossibleRandomization)) {
    gaps.push(gap('high', 'route_randomization_false_negative', 'Compiled predicate collision found multi-valid routes that parser semantics did not flag.', 'Use compiled predicate collision tests as fixtures for route_state_model.'));
  }
  if (directScriptRiskCount && !modeledDirectScriptCount) {
    gaps.push(gap('high', 'pre_route_script_simulation_gap', 'Some immediate routes read variables that the same scene writes in on-arrival before route selection, but the structured route model did not surface them.', 'Add or repair bounded safe on-arrival evidence before route predicate collision checks.'));
  } else if (directScriptRiskCount > modeledDirectScriptCount) {
    gaps.push(gap('medium', 'compiled_pre_route_reconciliation_gap', 'Compiled runtime script-risk count is higher than structured ProjectIndex pre-route evidence.', 'Reconcile compiled scene ids, source owners, and opaque JS blocks so Studio evidence matches runtime route owners.'));
  }
  if (opaqueOnlyRiskCount > modeledOpaqueScriptCount) {
    gaps.push(gap('medium', 'opaque_pre_route_script_gap', 'Some route-owning scenes run complex on-arrival code before route selection without matching structured opaque-script evidence.', 'Keep classifying opaque pre-route scripts separately from direct dependency writes and improve source-owner matching.'));
  }
  if (input.collisions.some((row) => row.zeroValidCount > 0)) {
    gaps.push(gap('medium', 'zero_valid_route_states', 'Some route groups can produce no valid target in sampled states.', 'Surface impossible/no-route states separately from overlap risk.'));
  }
  if (input.parserCoverage.missingCount || input.parserCoverage.mismatchedCount) {
    gaps.push(gap('medium', 'compiled_parser_route_coverage_gap', 'Some compiled route groups do not map cleanly back to structured route states.', 'Improve owner/source matching between ProjectIndex routeOrderGroups and compiled scene ids.'));
  }
  if (input.modelCollisionCoverage && input.modelCollisionCoverage.gapCount) {
    gaps.push(gap('medium', 'compiled_model_collision_fixture_gap', 'Some compiled multi-valid route groups are flagged as possible randomization but do not yet have model-side collision proof fixtures.', 'Promote these compiled collision samples into route_state_model fixtures or explain why broader scene preconditions make the sample irrelevant.'));
  }
  if (input.states.some((state) => state.runtimeSemantics && state.runtimeSemantics.possibleRandomization && state.runtimeSemantics.exclusivity === 'unknown_overlap')) {
    gaps.push(gap('medium', 'predicate_overlap_proof_gap', 'Unknown-overlap route groups remain heuristic unless sampled or solved.', 'Promote collision sampling for complex predicates and preserve sampled examples in UI evidence.'));
  }
  if (input.compiledGroups.some((group) => group.routeField === 'goToRef')) {
    gaps.push(gap('medium', 'dynamic_target_resolution_gap', 'go-to-ref is classified but possible runtime targets are not enumerated.', 'Trace quality writes that assign scene ids and connect them to go-to-ref rows.'));
  }
  if (input.compiledGroups.some((group) => ['goSub', 'goSubStart', 'goSubEnd', 'setJump'].includes(group.routeField))) {
    gaps.push(gap('low', 'subroutine_jump_flow_gap', 'set-jump/go-sub are visible but not modeled as full return-flow graphs.', 'Keep them review-first until a bounded call/return graph exists.'));
  }
  return gaps;
}

function gap(priority, id, finding, repair) {
  return {priority, id, finding, repair};
}

function recommendedRepairs(gaps) {
  const byId = new Set(gaps.map((gap) => gap.id));
  const rows = [];
  if (byId.has('pre_route_script_simulation_gap')) {
    rows.push('Add a bounded route trial evaluator: apply safe on-arrival assignments, then evaluate compiled predicates and route_state predicates against the same Q sample.');
  }
  if (byId.has('compiled_pre_route_reconciliation_gap')) {
    rows.push('Reconcile compiled route owners against ProjectIndex owners so pre-route script evidence is visible on the same route rows the editor renders.');
  }
  if (byId.has('opaque_pre_route_script_gap')) {
    rows.push('Split pre-route script warnings into direct dependency writes, opaque script-before-route, and no-script route groups so the editor can avoid one-size-fits-all manual review.');
  }
  if (byId.has('predicate_overlap_proof_gap')) {
    rows.push('Use stored RouteState collision summaries as focused fixtures, then reconcile any compiled/runtime multi-valid cases that still lack model-side proof.');
  }
  if (byId.has('compiled_parser_route_coverage_gap')) {
    rows.push('Add a route owner reconciliation check that maps compiled scene ids back to parser evidence groups by owner id, source line, and target set.');
  }
  if (byId.has('compiled_model_collision_fixture_gap')) {
    rows.push('Promote compiled multi-valid samples without model-side proof into focused route_state_model fixtures so parser confidence does not rely on this external audit alone.');
  }
  if (byId.has('dynamic_target_resolution_gap')) {
    rows.push('Index quality-to-scene assignments for go-to-ref, then present possible targets instead of only "dynamic".');
  }
  rows.push('Keep source rewrites conservative for unknown-overlap groups; offer explicit-fallback repair proposals only when the target set is source-backed.');
  return rows;
}

function sampleCases(input) {
  return {
    provenRandom: input.collisions.filter((row) => row.multiValidCount > 0).slice(0, 8),
    zeroValid: input.collisions.filter((row) => row.zeroValidCount > 0).slice(0, 8),
    explicitExclusive: input.collisions.filter((row) => row.parserExclusivity === 'explicit_complement' && row.multiValidCount === 0).slice(0, 8),
    directScriptRouteRisks: input.scriptRisks.filter((row) => row.intersectingWrites.length).slice(0, 12),
    opaqueScriptRouteRisks: input.scriptRisks.filter((row) => !row.intersectingWrites.length && row.opaqueScript).slice(0, 12),
    modelPreRouteDependencyWrites: input.states.filter((state) => state.preRouteScript && state.preRouteScript.routeDependencyWriteCount > 0).slice(0, 12).map((state) => ({
      ownerId: state.ownerId,
      routeField: state.routeField,
      status: state.preRouteScript.status,
      directDependencyWrites: state.preRouteScript.directDependencyWrites,
      source: state.source
    })),
    modelCollisionProvenMulti: input.states.filter((state) => state.runtimeSemantics && state.runtimeSemantics.collisionSummary && state.runtimeSemantics.collisionSummary.after && state.runtimeSemantics.collisionSummary.after.multiValidCount > 0).slice(0, 12).map((state) => ({
      ownerId: state.ownerId,
      routeField: state.routeField,
      selectionMode: state.runtimeSemantics.selectionMode,
      verdict: state.runtimeSemantics.collisionSummary.verdict,
      multiValidCount: state.runtimeSemantics.collisionSummary.after.multiValidCount,
      source: state.source
    })),
    compiledMultiValidWithoutModelProof: ((input.modelCollisionCoverage && input.modelCollisionCoverage.missingModelProof) || []).slice(0, 12).map((row) => ({
      ownerId: row.ownerId,
      parserSelection: row.parserSelection,
      parserExclusivity: row.parserExclusivity,
      compiledMultiValidCount: row.compiledMultiValidCount,
      targets: row.targets
    })),
    unknownOverlapStates: input.states.filter((state) => state.runtimeSemantics && state.runtimeSemantics.exclusivity === 'unknown_overlap').slice(0, 12).map((state) => ({
      ownerId: state.ownerId,
      source: state.source,
      candidates: state.candidates.map((candidate) => ({target: candidate.resolvedTarget || candidate.rawTarget, predicate: candidate.predicate})),
      reason: state.runtimeSemantics.reason
    }))
  };
}

function domainsForState(state, dependencies, group) {
  const domains = {};
  dependencies.forEach((name) => {
    domains[name] = [0, 1];
  });
  const candidates = state && state.candidates || [];
  candidates.forEach((candidate) => {
    const summary = candidate.predicateSummary || {};
    (summary.comparisons || []).forEach((comparison) => {
      addComparisonValues(domains, comparison);
    });
  });
  (group && group.candidates || []).forEach((candidate) => {
    addCompiledPredicateValues(domains, candidate.predicateCode);
  });
  Object.keys(domains).forEach((name) => {
    domains[name] = unique(domains[name]).slice(0, 6);
  });
  return domains;
}

function addComparisonValues(domains, comparison) {
  const left = String(comparison.left || '');
  const right = String(comparison.right || '');
  const deps = comparison.dependencies || [];
  const variable = deps.find((name) => left === name || right === name) || deps[0];
  if (!variable) return;
  const literal = left === variable ? right : left;
  if (!domains[variable]) domains[variable] = [0, 1];
  if (/^-?\d+(?:\.\d+)?$/.test(literal)) {
    const n = Number(literal);
    domains[variable].push(n - 1, n, n + 1);
  } else if (/^['"].*['"]$/.test(literal)) {
    domains[variable].push(literal.slice(1, -1), '__other__');
  }
}

function addCompiledPredicateValues(domains, code) {
  const text = String(code || '');
  const pattern = /Q\[['"]([^'"]+)['"]\](?:\s*\|\|\s*0)?\s*\)*\s*(?:==|!=|>=|<=|>|<)\s*("[^"]*"|'[^']*'|-?\d+(?:\.\d+)?)/g;
  let match = pattern.exec(text);
  while (match) {
    const variable = match[1];
    const literal = match[2];
    if (!domains[variable]) domains[variable] = [0, 1];
    if (/^-?\d+(?:\.\d+)?$/.test(literal)) {
      const n = Number(literal);
      domains[variable].push(n - 1, n, n + 1);
    } else if (/^['"].*['"]$/.test(literal)) {
      domains[variable].push(literal.slice(1, -1), '__other__');
    }
    match = pattern.exec(text);
  }
}

function sampleStates(domains, sampleLimit) {
  const names = Object.keys(domains).slice(0, 10);
  if (!names.length) return [{}];
  const product = names.reduce((total, name) => total * Math.max(1, domains[name].length), 1);
  if (product <= sampleLimit) {
    const rows = [{}];
    names.forEach((name) => {
      const next = [];
      rows.forEach((row) => {
        domains[name].forEach((value) => next.push(Object.assign({}, row, {[name]: value})));
      });
      rows.splice(0, rows.length, ...next);
    });
    return rows;
  }
  const rows = [];
  let seed = 1337;
  for (let index = 0; index < sampleLimit; index += 1) {
    const row = {};
    names.forEach((name) => {
      const values = domains[name];
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      row[name] = values[seed % values.length];
    });
    rows.push(row);
  }
  return rows;
}

function predicateEvaluator(code) {
  if (!code) return () => true;
  try {
    const fn = new Function('Q', code);
    return (Q) => {
      try {
        return Boolean(fn(Q));
      } catch (_err) {
        return false;
      }
    };
  } catch (_err) {
    return () => false;
  }
}

function codeList(value) {
  return Array.isArray(value) ? value.map((row) => String(row && row.$code || '')).filter(Boolean) : [];
}

function variablesInCode(code) {
  const values = [];
  const pattern = /Q\[['"]([^'"]+)['"]\]|Q\.([A-Za-z_][A-Za-z0-9_]*)/g;
  let match = pattern.exec(String(code || ''));
  while (match) {
    values.push(match[1] || match[2]);
    match = pattern.exec(String(code || ''));
  }
  return unique(values);
}

function writeVarsFromCode(code) {
  const values = [];
  const pattern = /Q\[['"]([^'"]+)['"]\]\s*(?:=|\+=|-=|\*=|\/=|%=)(?!=)|Q\.([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|\+=|-=|\*=|\/=|%=)(?!=)|(?:\+\+|--)\s*Q\[['"]([^'"]+)['"]\]|(?:\+\+|--)\s*Q\.([A-Za-z_][A-Za-z0-9_]*)|Q\[['"]([^'"]+)['"]\]\s*(?:\+\+|--)|Q\.([A-Za-z_][A-Za-z0-9_]*)\s*(?:\+\+|--)/g;
  let match = pattern.exec(String(code || ''));
  while (match) {
    values.push(match[1] || match[2] || match[3] || match[4] || match[5] || match[6]);
    match = pattern.exec(String(code || ''));
  }
  return unique(values);
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Route Semantics Audit Report');
  lines.push('');
  lines.push('Generated: `' + report.generatedAt + '`');
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('- Project root: `' + displayPath(report.projectRoot) + '`');
  lines.push('- ProjectIndex: `' + displayPath(report.indexPath) + '`');
  lines.push('- Runtime JSON: `' + displayPath(report.gamePath) + '`');
  lines.push('- Synthetic state sample limit per route group: `' + report.sampleLimit + '`');
  lines.push('- Input sources: Studio ProjectIndex route states plus compiled DendryNexus `out/game.json` runtime routes.');
  lines.push('- Re-run: `node tools/project_map/qa/route_semantics_audit.js --root SDAAHdynamic/dynamic_social_democracy-main --json-out /tmp/dms_route_semantics_audit.json --markdown-out /tmp/dms_route_semantics_audit.md --sample-limit 512 --include-excerpts`');
  lines.push('');
  lines.push('## Method');
  lines.push('');
  lines.push('1. Build or load a Studio ProjectIndex with route-order evidence.');
  lines.push('2. Load compiled runtime route arrays from `out/game.json` (`goTo`, `goToRef`, subroutine routes, and `setJump`).');
  lines.push('3. Reconstruct route groups by runtime scene id and route field.');
  lines.push('4. Generate bounded synthetic `Q` states from parsed predicate comparisons.');
  lines.push('5. Execute compiled predicate functions over those states and compare the result with Studio route semantics.');
  lines.push('6. Flag parser coverage mismatches, multi-valid randomization cases, zero-valid cases, and scripts that write route dependencies before selection.');
  lines.push('');
  lines.push('## Headline Results');
  lines.push('');
  Object.keys(report.summary).forEach((key) => {
    lines.push('- `' + key + '`: ' + report.summary[key]);
  });
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  if (!report.gaps.some((gap) => gap.id === 'route_randomization_false_negative')) {
    lines.push('- Studio route semantics agreed with every sampled compiled multi-valid route group in this run; the current parser is no longer blind to DendryNexus random-among-valid routing.');
  }
  if (report.modelCollisionCoverage && report.modelCollisionCoverage.gapCount) {
    lines.push('- Some compiled multi-valid samples still lack model-side collision-proof fixtures. Treat these as fixture-promotion and context-reconciliation work, not immediate source-edit permission.');
  }
  if (report.summary.modelPreRouteDependencyWriteCount || report.summary.modelCollisionTestedRouteCount) {
    lines.push('- Studio now stores structured evidence for pre-route `on-arrival` writes and bounded route collision trials on route-state rows.');
  }
  lines.push('- The largest remaining risk is no longer basic `go-to` parsing. It is reconciliation: proving that source-backed Studio evidence and compiled runtime route owners describe the same route group.');
  lines.push('- Parser coverage drift is small in count but high in diagnostic value, because a single missed sibling clause can make an editor think a route is direct when runtime has multiple candidates.');
  lines.push('- Collision sampling is useful as a repair guide, but it should graduate into focused fixtures before changing automatic source rewrites.');
  lines.push('');
  lines.push('## How To Read This For Editing');
  lines.push('');
  lines.push('- `parserCoverageMissingCount` and `parserCoverageMismatchCount` are the real parser alarm bells. If both are `0`, compiled runtime route groups have matching structured Studio evidence outside known protected boundaries.');
  lines.push('- `parserCoverageProtectedBoundaryCount` means Studio intentionally keeps router-owned source as review-only evidence. This is usually `post_event` style routing, not a broken event parser.');
  lines.push('- `modelCollisionCoverageGapCount` points to missing fixtures: the parser already suspects random-among-valid behavior, but the model should preserve a concrete proof sample before we trust automatic route rewrites.');
  lines.push('- `collisionZeroValidCount` is a triage signal. It can reveal impossible sampled states, broader scene preconditions that the audit did not model, or a real missing fallback.');
  lines.push('- Editing policy should follow the evidence: direct source-backed text and simple effects can be guarded, route-order rewrites stay advanced, and protected router boundaries stay review-first.');
  lines.push('');
  lines.push('## Gaps');
  lines.push('');
  report.gaps.forEach((gap) => {
    lines.push('### [' + gap.priority + '] ' + gap.id);
    lines.push('');
    lines.push(gap.finding);
    lines.push('');
    lines.push('Repair: ' + gap.repair);
    lines.push('');
  });
  lines.push('## High-Value Collision Samples');
  lines.push('');
  table(lines, ['ownerId', 'compiledSelection', 'parserSelection', 'parserExclusivity', 'multiValid', 'zeroValid'], report.sampleCases.provenRandom.slice(0, 10).map((row) => [
    row.ownerId,
    row.compiledSelection,
    row.parserSelection,
    row.parserExclusivity,
    row.multiValidCount,
    row.zeroValidCount
  ]));
  lines.push('');
  lines.push('### Example Multi-Valid States');
  lines.push('');
  report.sampleCases.provenRandom.slice(0, 3).forEach((row) => {
    lines.push('- `' + row.ownerId + '` can select `' + (row.examples.multiValid[0] && row.examples.multiValid[0].validTargets || []).join('`, `') + '` when `Q` includes:');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(row.examples.multiValid[0] && row.examples.multiValid[0].state || {}, null, 2));
    lines.push('```');
    lines.push('');
  });
  lines.push('## Zero-Valid Samples');
  lines.push('');
  table(lines, ['ownerId', 'zeroValid', 'targets'], report.sampleCases.zeroValid.slice(0, 10).map((row) => [
    row.ownerId,
    row.zeroValidCount,
    row.targets.join(', ')
  ]));
  lines.push('');
  lines.push('## Explicit Exclusive Samples');
  lines.push('');
  table(lines, ['ownerId', 'parserSelection', 'parserExclusivity', 'targets'], report.sampleCases.explicitExclusive.slice(0, 10).map((row) => [
    row.ownerId,
    row.parserSelection,
    row.parserExclusivity,
    row.targets.join(', ')
  ]));
  lines.push('');
  lines.push('## Script Before Route Risks');
  lines.push('');
  lines.push('### Direct Dependency Writes');
  lines.push('');
  table(lines, ['ownerId', 'routeField', 'intersectingWrites', 'routeDependencies'], report.sampleCases.directScriptRouteRisks.slice(0, 12).map((row) => [
    row.ownerId,
    row.routeField,
    row.intersectingWrites.join(', '),
    row.routeDependencies.slice(0, 8).join(', ')
  ]));
  lines.push('');
  lines.push('### Opaque Script Before Route');
  lines.push('');
  table(lines, ['ownerId', 'routeField', 'writtenVariables'], report.sampleCases.opaqueScriptRouteRisks.slice(0, 12).map((row) => [
    row.ownerId,
    row.routeField,
    row.onArrivalWrites.slice(0, 8).join(', ')
  ]));
  lines.push('');
  lines.push('## Studio Model Evidence');
  lines.push('');
  table(lines, ['kind', 'count'], [
    ['pre-route script rows', report.summary.modelPreRouteScriptCount],
    ['pre-route dependency writes', report.summary.modelPreRouteDependencyWriteCount],
    ['opaque pre-route script rows', report.summary.modelPreRouteOpaqueScriptCount],
    ['collision-tested routes', report.summary.modelCollisionTestedRouteCount],
    ['collision-proven multi-valid routes', report.summary.modelCollisionProvenMultiValidCount]
  ]);
  lines.push('');
  lines.push('### Model Pre-Route Dependency Samples');
  lines.push('');
  table(lines, ['ownerId', 'routeField', 'writes', 'status'], report.sampleCases.modelPreRouteDependencyWrites.slice(0, 10).map((row) => [
    row.ownerId,
    row.routeField,
    row.directDependencyWrites.join(', '),
    row.status
  ]));
  lines.push('');
  lines.push('### Model Collision Samples');
  lines.push('');
  table(lines, ['ownerId', 'routeField', 'verdict', 'multiValid'], report.sampleCases.modelCollisionProvenMulti.slice(0, 10).map((row) => [
    row.ownerId,
    row.routeField,
    row.verdict,
    row.multiValidCount
  ]));
  lines.push('');
  lines.push('### Compiled Multi-Valid Without Model Proof');
  lines.push('');
  table(lines, ['ownerId', 'compiledMultiValid', 'parserSelection', 'parserExclusivity', 'targets'], (report.modelCollisionCoverage.missingModelProof || []).slice(0, 12).map((row) => [
    row.ownerId,
    row.compiledMultiValidCount,
    row.parserSelection,
    row.parserExclusivity,
    row.targets.join(', ')
  ]));
  lines.push('');
  lines.push('## Parser Coverage Drift');
  lines.push('');
  lines.push('- Protected router boundaries: `' + (report.parserCoverage.protectedBoundaryCount || 0) + '`');
  lines.push('- Missing compiled route groups: `' + report.parserCoverage.missingCount + '`');
  lines.push('- Candidate-count mismatches: `' + report.parserCoverage.mismatchedCount + '`');
  if (report.parserCoverage.protectedBoundaryCount) {
    lines.push('');
    lines.push('### Protected Router Boundaries');
    lines.push('');
    table(lines, ['ownerId', 'routeField', 'compiled', 'parsed', 'reason'], report.parserCoverage.protectedBoundaries.slice(0, 10).map((row) => [
      row.ownerId,
      row.routeField,
      row.compiledCandidateCount,
      row.routeStateCandidateCount,
      row.reason
    ]));
  }
  lines.push('');
  lines.push('### Missing Compiled Route Groups');
  lines.push('');
  table(lines, ['ownerId', 'routeField', 'compiled'], report.parserCoverage.missing.slice(0, 10).map((row) => [
    row.ownerId,
    row.routeField,
    row.compiledCandidateCount
  ]));
  lines.push('');
  lines.push('### Candidate Count Mismatches');
  lines.push('');
  table(lines, ['ownerId', 'routeField', 'compiled', 'parsed'], report.parserCoverage.mismatched.slice(0, 10).map((row) => [
    row.ownerId,
    row.routeField,
    row.compiledCandidateCount,
    row.routeStateCandidateCount
  ]));
  lines.push('');
  lines.push('## Recommended Repair Chain');
  lines.push('');
  report.recommendedRepairs.forEach((item, index) => lines.push(String(index + 1) + '. ' + item));
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- Collision tests evaluate compiled predicate code from local `out/game.json` over synthetic Q states derived from parsed predicate comparisons.');
  lines.push('- A sampled single-valid result is evidence, not proof, for complex predicates with large domains.');
  lines.push('- A zero-valid sample can mean the route is intentionally unreachable outside its wider event preconditions, that synthetic state generation is incomplete, or that parser coverage drift hid sibling clauses. Treat it as a triage signal, not an automatic source bug.');
  lines.push('- The audit intentionally treats complex predicates conservatively. It should reveal likely gaps, then become focused fixtures before broad parser changes.');
  lines.push('- Source edits should remain conservative when route semantics are `unknown_overlap` or when pre-route scripts write route dependencies.');
  lines.push('');
  return lines.join('\n');
}

function displayPath(filePath) {
  const value = String(filePath || '');
  if (!value) return '';
  const relative = path.relative(REPO_ROOT, value);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative;
  }
  return value;
}

function table(lines, headers, rows) {
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
  if (!rows.length) {
    lines.push('| ' + headers.map(() => '').join(' | ') + ' |');
    return;
  }
  rows.forEach((row) => {
    lines.push('| ' + row.map((cell) => String(cell).replace(/\|/g, '\\|')).join(' | ') + ' |');
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, content);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null && value !== '')));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(String(err && err.stack || err) + '\n');
    process.exit(1);
  }
}

module.exports = {
  buildReport,
  renderMarkdown,
  parserCoverageFor,
  modelCollisionCoverageFor,
  compiledRouteGroups
};
