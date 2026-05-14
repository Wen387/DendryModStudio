#!/usr/bin/env node
'use strict';

const confidenceModel = require('./authoring/parser_renderer_confidence_model.js');
const graphModel = require('./authoring/semantic_ownership_graph_model.js');
const workbenchModel = require('./authoring/dynamic_semantic_workbench_model.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function src(path, line, anchorText) {
  const out = {path, line, startLine: line, endLine: line};
  if (anchorText) {
    out.anchorText = anchorText;
  }
  return out;
}

function scene(id, type, title, path) {
  return {
    id,
    type,
    title,
    path,
    sourceSpan: {path, startLine: 1, endLine: 80},
    topLevelSpan: {path, startLine: 1, endLine: 80},
    options: [],
    sections: [],
    effects: []
  };
}

const routePath = 'source/scenes/routes/custom_route.scene.dry';
const dynamicPath = 'source/scenes/events/custom_dynamic.scene.dry';
const customRouterPath = 'source/scenes/system/custom_router.scene.dry';
const customEventPath = 'source/scenes/events/custom_profile_event.scene.dry';

const index = {
  project: {name: 'Generalized Semantic Evidence Fixture', profileIds: ['synthetic-profile']},
  scenes: [
    scene('custom_route', 'event', 'Custom Route', routePath),
    scene('custom_dynamic', 'event', 'Custom Dynamic', dynamicPath),
    scene('custom_profile_event', 'event', 'Custom Profile Event', customEventPath)
  ],
  edges: [],
  variables: [
    {name: 'custom_state_alpha', scope: 'q', reads: [src(dynamicPath, 24)], writes: [src(dynamicPath, 28)], definedIn: [], readCount: 1, writeCount: 1}
  ],
  diagnostics: [],
  semantic: {
    events: [
      {id: 'custom_route', title: 'Custom Route'},
      {id: 'custom_dynamic', title: 'Custom Dynamic'},
      {id: 'custom_profile_event', title: 'Custom Profile Event'}
    ],
    news: {eventPopups: []},
    textCorpus: {
      items: [
        {id: 'text:custom_route', role: 'body', text: 'Route text.', owner: {kind: 'scene', sceneId: 'custom_route'}, source: src(routePath, 12, 'Route text.')},
        {id: 'text:custom_dynamic', role: 'body', text: 'Dynamic text.', owner: {kind: 'scene', sceneId: 'custom_dynamic'}, source: src(dynamicPath, 12, 'Dynamic text.')}
      ]
    },
    runtimeSurface: {readiness: {status: 'unknown'}, diagnostics: []},
    parserEvidence: {
      schemaVersion: '0.2',
      kind: 'parser_semantic_evidence',
      core: {
        routeOrderGroups: [{
          id: 'custom_route_order',
          sceneId: 'custom_route',
          ownerId: 'custom_route',
          routeField: 'goTo',
          chainContext: 'ordered_chain',
          source: src(routePath, 32),
          parserBacked: true,
          installSafety: 'manual_review',
          clauses: [
            {order: 1, rawTarget: 'branch_a', resolvedTarget: 'custom_route.branch_a', targetResolved: true, predicate: 'custom_flag', isFallback: false},
            {order: 2, rawTarget: 'branch_b', resolvedTarget: 'custom_route.branch_b', targetResolved: true, predicate: '', isFallback: true}
          ]
        }],
        dynamicKeyEvidence: [
          {
            id: 'custom_dynamic_manual',
            expression: "customPrefix + '_state'",
            accessKind: 'write',
            classification: 'dynamic_concatenation',
            source: src(dynamicPath, 24),
            safeExpansion: false,
            expandedKeys: [],
            bindingSources: [{name: 'customPrefix', kind: 'unresolved_identifier', valueCount: 0}],
            reviewBoundary: 'manual_review',
            installSafety: 'manual_review'
          },
          {
            id: 'custom_dynamic_safe',
            expression: "known + '_state'",
            accessKind: 'read',
            classification: 'dynamic_concatenation',
            source: src(dynamicPath, 25),
            safeExpansion: true,
            expandedKeys: ['alpha_state', 'beta_state'],
            expandedKeyCount: 2,
            bindingSources: [{name: 'known', kind: 'known_array', valueCount: 2}],
            reviewBoundary: 'guarded_candidate',
            installSafety: 'guarded_candidate'
          }
        ],
        effectClauses: [
          {id: 'custom_effect_a', sceneId: 'custom_dynamic', ownerId: 'custom_dynamic', variable: 'custom_state_alpha', op: '=', value: '1', sourceExpression: 'custom_state_alpha = 1', clauseOrder: 1, lineEffectCount: 2, sharedLineGroupId: 'custom_effect_line', tokenUniqueOnLine: false, installSafety: 'manual_review', source: src(dynamicPath, 28, 'custom_state_alpha = 1; custom_state_alpha = 2')},
          {id: 'custom_effect_b', sceneId: 'custom_dynamic', ownerId: 'custom_dynamic', variable: 'custom_state_alpha', op: '=', value: '2', sourceExpression: 'custom_state_alpha = 2', clauseOrder: 2, lineEffectCount: 2, sharedLineGroupId: 'custom_effect_line', tokenUniqueOnLine: true, installSafety: 'guarded_candidate', source: src(dynamicPath, 28, 'custom_state_alpha = 1; custom_state_alpha = 2')}
        ],
        summary: {
          routeOrderGroupCount: 1,
          dynamicKeyEvidenceCount: 2,
          dynamicKeyManualReviewCount: 1,
          dynamicKeySafeExpansionCount: 1,
          effectClauseCount: 2
        }
      },
      profiles: [{
        profileId: 'synthetic-profile',
        profileName: 'Synthetic Profile',
        packages: [{
          id: 'custom_router_review',
          profileId: 'synthetic-profile',
          kind: 'router_table',
          label: 'Custom Router Review',
          rowCount: 1,
          ownerCount: 1,
          installSafety: 'manual_review',
          reason: 'Synthetic profile router entries must be reviewed through the owning event.',
          recommendedNextAction: 'Open the linked event and review the profile router boundary.',
          evidence: {routerTableId: 'custom_router_table'}
        }],
        routerTables: [{
          id: 'custom_router_table',
          profileId: 'synthetic-profile',
          packageId: 'custom_router_review',
          kind: 'router_table',
          source: 'synthetic.routerRows',
          rowCount: 1,
          installSafety: 'manual_review',
          reason: 'Synthetic router table remains review-first.',
          recommendedNextAction: 'Review the linked event before install.',
          rows: [{
            id: 'custom_router_row',
            kind: 'custom_router_entry',
            profileId: 'synthetic-profile',
            packageId: 'custom_router_review',
            routerTableId: 'custom_router_table',
            linkedSceneId: 'custom_profile_event',
            title: 'Custom Profile Event',
            router: {tag: 'custom', anchor: 'custom_router', source: src(customRouterPath, 44)},
            contentSource: src(customEventPath, 11),
            installSafety: 'manual_review',
            reviewBoundary: 'manual_review',
            reason: 'Synthetic router row remains manual review.'
          }]
        }],
        protectedBoundaries: [{id: 'synthetic_generated', profileId: 'synthetic-profile', kind: 'protected_boundary', boundary: 'synthetic-generated', pathRegex: '^generated/'}],
        variableSystems: [{id: 'custom_state', profileId: 'synthetic-profile', kind: 'variable_family', family: 'custom_state', nameRegex: '^custom_state_'}],
        summary: {packageCount: 1, routerTableCount: 1, protectedBoundaryCount: 1, variableSystemCount: 1}
      }],
      summary: {
        routeOrderGroupCount: 1,
        dynamicKeyEvidenceCount: 2,
        dynamicKeyManualReviewCount: 1,
        dynamicKeySafeExpansionCount: 1,
        effectClauseCount: 2,
        profileEvidenceCount: 1,
        profilePackageCount: 1,
        profileRouterTableCount: 1
      }
    }
  }
};

const confidence = confidenceModel.buildConfidenceReport(index, {sampleLimit: 4});
assert(confidence.routeOrder.structuredGroupCount === 1, 'confidence should read route groups from parserEvidence.core', confidence.routeOrder);
assert(confidence.dynamicQ.structuredEvidenceCount === 2 && confidence.dynamicQ.manualReviewCount === 1, 'confidence should read dynamic keys from parserEvidence.core', confidence.dynamicQ);
assert(confidence.sharedEffects.clauseCount === 2, 'confidence should read effect clauses from parserEvidence.core', confidence.sharedEffects);

const graph = graphModel.buildSemanticOwnershipGraph(index, {
  sampleLimit: 4,
  workflows: [
    {id: 'route_custom', kind: 'route_order', sceneId: 'custom_route'},
    {id: 'dynamic_custom', kind: 'dynamic_q', sceneId: 'custom_dynamic'}
  ]
});
const packages = Object.fromEntries(graph.manualBoundaryPackages.map((item) => [item.id, item]));
assert(packages.custom_router_review, 'graph should expose arbitrary profile-declared packages', graph.manualBoundaryPackages);
assert(packages.custom_router_review.profileId === 'synthetic-profile', 'profile package should preserve profile ownership', packages.custom_router_review);
assert(packages.custom_router_review.evidence.routerRows[0].linkedSceneId === 'custom_profile_event', 'profile package should carry router row evidence', packages.custom_router_review);

const lookup = graphModel.buildLookup(index);
assert(lookup.routeOrderGroups.length === 1 && lookup.dynamicKeyEvidence.length === 2 && lookup.effectClauses.length === 2, 'lookup should prefer parserEvidence.core rows', lookup);
assert(lookup.profilePackages.length === 1 && lookup.profileRouterRows.length === 1, 'lookup should flatten profile evidence rows', lookup);

const workbench = workbenchModel.buildDynamicSemanticWorkbench(index, {
  sampleLimit: 4,
  workflows: [
    {id: 'route_custom', kind: 'route_order', sceneId: 'custom_route'},
    {id: 'dynamic_custom', kind: 'dynamic_q', sceneId: 'custom_dynamic'}
  ]
});
assert(workbench.profileEvidence.profileCount === 1, 'workbench should surface profile evidence summary', workbench.profileEvidence);
assert(workbench.manualBoundaryPackages.some((item) => item.id === 'custom_router_review'), 'workbench should carry arbitrary profile packages', workbench.manualBoundaryPackages);

process.stdout.write(JSON.stringify({
  ok: true,
  confidence: confidence.summary,
  packageIds: graph.manualBoundaryPackages.map((item) => item.id),
  profileEvidence: workbench.profileEvidence
}, null, 2) + '\n');
