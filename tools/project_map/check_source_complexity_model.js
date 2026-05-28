#!/usr/bin/env node
'use strict';

// Regression guard for the one-way complexity-budget ratchet in
// check_source_complexity.js: budget ceilings may only fall, and --tighten
// lowers them to the current line count without ever raising.

const {assert} = require('./check_harness.js');
const {evaluateNoRaise, tightenEntries} = require('./check_source_complexity');

let count = 0;
function check(condition, message) {
  count += 1;
  assert(condition, message);
}

// --- evaluateNoRaise: ceilings may only fall ---

(function noRaiseFlagsAnIncrease() {
  const budget = {exceptions: new Map([['a.js', {maxLines: 120}]])};
  const committed = new Map([['a.js', 110]]);
  const problems = evaluateNoRaise(budget, committed);
  check(problems.length === 1, 'a raised ceiling should produce one problem');
  check(problems[0].kind === 'ceiling-raised', 'problem kind should be ceiling-raised');
  check(problems[0].from === 110 && problems[0].entry.maxLines === 120, 'problem should carry committed-vs-current');
})();

(function noRaiseAllowsEqualAndLower() {
  const budget = {exceptions: new Map([
    ['a.js', {maxLines: 100}],
    ['b.js', {maxLines: 90}]
  ])};
  const committed = new Map([['a.js', 100], ['b.js', 120]]);
  const problems = evaluateNoRaise(budget, committed);
  check(problems.length === 0, 'equal and lowered ceilings must not be flagged');
})();

(function noRaiseRespectsAllowRaise() {
  const budget = {exceptions: new Map([['a.js', {maxLines: 200, allowRaise: true}]])};
  const committed = new Map([['a.js', 100]]);
  const problems = evaluateNoRaise(budget, committed);
  check(problems.length === 0, 'allowRaise:true should exempt a deliberate, reviewed raise');
})();

(function noRaiseSkipsWithoutCommittedBaseline() {
  const budget = {exceptions: new Map([['a.js', {maxLines: 200}]])};
  const problems = evaluateNoRaise(budget, null);
  check(problems.length === 0, 'a missing committed baseline (no git) should skip the check');
})();

// --- tightenEntries: lower-only and idempotent ---

(function tightenLowersSlackToCurrent() {
  const exceptions = [{path: 'a.js', maxLines: 100}, {path: 'b.js', maxLines: 90}];
  const lineByPath = new Map([['a.js', 80], ['b.js', 90]]);
  const changes = tightenEntries(exceptions, lineByPath);
  check(changes.length === 1, 'only the slack entry should change');
  check(changes[0].path === 'a.js' && changes[0].from === 100 && changes[0].to === 80, 'change should record from/to');
  check(exceptions[0].maxLines === 80, 'a slack ceiling should fall to the current line count');
  check(exceptions[1].maxLines === 90, 'an already-tight ceiling should stay');
  const again = tightenEntries(exceptions, lineByPath);
  check(again.length === 0, 'tighten must be idempotent');
})();

(function tightenNeverRaises() {
  const exceptions = [{path: 'a.js', maxLines: 100}];
  const lineByPath = new Map([['a.js', 140]]);
  const changes = tightenEntries(exceptions, lineByPath);
  check(changes.length === 0, 'tighten must never raise a ceiling, even if the file grew');
  check(exceptions[0].maxLines === 100, 'ceiling stays put when the current size exceeds it');
})();

process.stdout.write('PASS: source complexity ratchet model (' + count + ' assertions)\n');
