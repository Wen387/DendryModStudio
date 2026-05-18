#!/usr/bin/env node
// @ts-check
'use strict';

const routeState = require('./authoring/route_state_model.js');

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function summary(raw) {
  return routeState.summarizePredicate(raw);
}

function includesAll(values, expected) {
  return expected.every((value) => values.includes(value));
}

const windowed = summary('year = 1928 and (month >= 7 or not rubicon)');
assert(windowed.status === 'parsed', 'windowed predicate should parse', windowed);
assert(includesAll(windowed.dependencies, ['year', 'month', 'rubicon']), 'windowed predicate should expose all dependencies', windowed);
assert(includesAll(windowed.operators, ['=', 'and', '>=', 'or', 'not']), 'windowed predicate should expose boolean/comparison operators', windowed);

const bare = summary('Q.route_flag');
assert(bare.status === 'parsed', 'bare Q flag should parse', bare);
assert(bare.dependencies.length === 1 && bare.dependencies[0] === 'route_flag', 'bare Q flag should normalize dependency', bare);

const coalition = summary('z_relation >= 60 and resources >= 1');
assert(coalition.status === 'parsed', 'coalition predicate should parse', coalition);
assert(coalition.comparisons.length === 2, 'coalition predicate should expose two comparisons', coalition);
assert(includesAll(coalition.dependencies, ['z_relation', 'resources']), 'coalition predicate should expose dependencies', coalition);

const arithmetic = summary('left_strength <= reformist_strength + center_strength');
assert(arithmetic.status === 'parsed', 'arithmetic comparison should parse', arithmetic);
assert(includesAll(arithmetic.dependencies, ['left_strength', 'reformist_strength', 'center_strength']), 'arithmetic comparison should expose both sides', arithmetic);
assert(arithmetic.operators.includes('+') && arithmetic.operators.includes('<='), 'arithmetic comparison should expose arithmetic and comparison operators', arithmetic);

const dynamic = summary("Q[party + '_running'] > 0 and Q.route_flag");
assert(dynamic.status === 'dynamic', 'dynamic Q bracket predicate should be parsed with dynamic status', dynamic);
assert(dynamic.dynamicRefs.length === 1, 'dynamic Q predicate should expose dynamic ref', dynamic);
assert(includesAll(dynamic.dependencies, ['party', 'route_flag']), 'dynamic Q predicate should expose binding and normal dependencies', dynamic);
assert(!dynamic.dependencies.includes('_running'), 'dynamic Q dependency extraction should ignore string literal suffixes', dynamic);

const opaque = summary('route_flag &&& broken');
assert(opaque.status === 'opaque', 'unsupported predicate should remain opaque', opaque);
assert(includesAll(opaque.dependencies, ['route_flag', 'broken']), 'opaque fallback should still expose regex dependencies', opaque);
assert(opaque.opaqueReasons.length > 0, 'opaque predicate should explain why it is opaque', opaque);

const incomplete = summary('route_flag and');
assert(incomplete.status === 'opaque', 'incomplete predicate should not produce a partial parsed AST', incomplete);
assert(includesAll(incomplete.dependencies, ['route_flag']), 'incomplete predicate should keep fallback dependencies', incomplete);

process.stdout.write(JSON.stringify({
  ok: true,
  parsed: [windowed.status, bare.status, coalition.status, arithmetic.status],
  dynamic: dynamic.dynamicRefs[0],
  opaqueReasons: opaque.opaqueReasons.concat(incomplete.opaqueReasons)
}, null, 2) + '\n');
