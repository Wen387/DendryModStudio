#!/usr/bin/env node
// @ts-check
'use strict';

const audit = require('./qa/route_semantics_audit.js');

const {fail, assert} = require('./check_harness.js');

function src(filePath, line) {
  return {path: filePath, line, startLine: line, endLine: line};
}

function routeGroup(id, ownerId, clauses, line) {
  const filePath = 'source/scenes/events/' + id + '.scene.dry';
  return {
    id: 'route_order_' + ownerId.replace(/[^A-Za-z0-9_]+/g, '_'),
    sceneId: id,
    ownerId,
    ownerKind: ownerId === id ? 'event' : 'section',
    routeField: 'goTo',
    routeKind: 'go_to',
    routeCount: clauses.length,
    chainContext: 'ordered_chain',
    source: src(filePath, line),
    sourceRaw: clauses.map((clause) => clause.raw).join('; '),
    parserBacked: true,
    confidence: 'exact',
    installSafety: 'manual_review',
    clauses
  };
}

const index = {
  schemaVersion: '0.1',
  project: {name: 'Route Semantics Audit Fixture'},
  scenes: [
    {id: 'ok_event', title: 'OK Event', type: 'event', path: 'source/scenes/events/ok_event.scene.dry', sections: [], options: []},
    {id: 'mismatch_event', title: 'Mismatch Event', type: 'event', path: 'source/scenes/events/mismatch_event.scene.dry', sections: [], options: []}
  ],
  edges: [],
  diagnostics: [],
  semantic: {
    parserEvidence: {
      routeOrderGroups: [
        routeGroup('ok_event', 'ok_event', [
          {order: 1, raw: 'left if flag >= 1', rawTarget: 'left', resolvedTarget: 'ok_event.left', targetResolved: true, predicate: 'flag >= 1', routeKind: 'conditional_go_to'},
          {order: 2, raw: 'right', rawTarget: 'right', resolvedTarget: 'ok_event.right', targetResolved: true, predicate: '', isFallback: true, routeKind: 'go_to'}
        ], 4),
        routeGroup('mismatch_event', 'mismatch_event', [
          {order: 1, raw: 'left if path = "left"', rawTarget: 'left', resolvedTarget: 'mismatch_event.left', targetResolved: true, predicate: 'path = "left"', routeKind: 'conditional_go_to'}
        ], 6)
      ]
    }
  }
};

const game = {
  scenes: {
    ok_event: {
      goTo: [
        {id: 'ok_event.left', predicate: {$code: 'return Q["flag"] >= 1;'}},
        {id: 'ok_event.right'}
      ]
    },
    mismatch_event: {
      goTo: [
        {id: 'mismatch_event.left', predicate: {$code: 'return Q["path"] == "left";'}},
        {id: 'mismatch_event.right', predicate: {$code: 'return Q["path"] == "right";'}}
      ]
    },
    missing_event: {
      goTo: [
        {id: 'missing_event.alpha', predicate: {$code: 'return Q["alpha"] >= 1;'}},
        {id: 'missing_event.beta', predicate: {$code: 'return Q["beta"] >= 1;'}}
      ]
    }
  }
};

const report = audit.buildReport({
  index,
  game,
  indexPath: '/tmp/route-semantics-audit-fixture-index.json',
  gamePath: '/tmp/route-semantics-audit-fixture-game.json',
  projectRoot: '/tmp/route-semantics-audit-fixture',
  sampleLimit: 64
});

assert(report.summary.parserCoverageMissingCount === 1, 'fixture should preserve missing compiled route group count', report.parserCoverage);
assert(report.summary.parserCoverageMismatchCount === 1, 'fixture should preserve route candidate mismatch count', report.parserCoverage);
assert(report.parserCoverage.missing[0].ownerId === 'missing_event', 'missing route group should name compiled owner', report.parserCoverage.missing);
assert(report.parserCoverage.mismatched[0].ownerId === 'mismatch_event', 'mismatch should name route owner', report.parserCoverage.mismatched);
assert(report.gaps.some((gap) => gap.id === 'compiled_parser_route_coverage_gap'), 'coverage drift should become a repair gap', report.gaps);

const markdown = audit.renderMarkdown(report);
assert(markdown.includes('## Parser Coverage Drift'), 'report should render parser coverage drift section');
assert(markdown.includes('### Missing Compiled Route Groups'), 'report should render missing compiled route group table');
assert(markdown.includes('| missing_event | goTo | 2 |'), 'missing table should include compiled owner and count');
assert(markdown.includes('### Candidate Count Mismatches'), 'report should render candidate mismatch table');
assert(markdown.includes('| mismatch_event | goTo | 2 | 1 |'), 'mismatch table should include compiled and parsed counts');

process.stdout.write(JSON.stringify({
  ok: true,
  parserCoverageMissingCount: report.summary.parserCoverageMissingCount,
  parserCoverageMismatchCount: report.summary.parserCoverageMismatchCount,
  gaps: report.gaps.map((gap) => gap.id)
}, null, 2) + '\n');
