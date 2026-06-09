#!/usr/bin/env node
'use strict';

// Regression guard for check_source_complexity.js budget governance:
//  - evaluateNoRaise: a frozen ceiling (no "allowRaise": true) may only fall.
//  - evaluateGrowth: an already-large (warn/exception) file may grow by at most
//    MAX_SINGLE_COMMIT_GROWTH lines versus its committed (HEAD) size in a single
//    commit. New files (no committed line count) and shrinks are never flagged;
//    ok-status files are not gated at all.

const {assert} = require('./check_harness.js');
const {evaluateNoRaise, evaluateGrowth, MAX_SINGLE_COMMIT_GROWTH} = require('./check_source_complexity');

let count = 0;
function check(condition, message) {
  count += 1;
  assert(condition, message);
}

// --- evaluateNoRaise: frozen ceilings may only fall ---

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

// --- evaluateGrowth: per-file single-commit growth gate ---

(function growthFlagsAnOversizedJump() {
  const rows = [{path: 'big.js', lines: 1900, status: 'exception'}];
  const head = new Map([['big.js', 1900 - (MAX_SINGLE_COMMIT_GROWTH + 1)]]);
  const {problems, growths} = evaluateGrowth(rows, head, MAX_SINGLE_COMMIT_GROWTH);
  check(problems.length === 1, 'a jump over the cap should produce one problem');
  check(problems[0].kind === 'growth-exceeded', 'problem kind should be growth-exceeded');
  check(problems[0].delta === MAX_SINGLE_COMMIT_GROWTH + 1 && problems[0].from === 1900 - (MAX_SINGLE_COMMIT_GROWTH + 1), 'problem should carry delta and committed size');
  check(growths.length === 1 && growths[0].delta === MAX_SINGLE_COMMIT_GROWTH + 1, 'the change should also surface in the advisory growths');
})();

(function growthAllowsAtOrBelowTheCap() {
  const rows = [{path: 'big.js', lines: 1900, status: 'exception'}];
  const head = new Map([['big.js', 1900 - MAX_SINGLE_COMMIT_GROWTH]]);
  const {problems} = evaluateGrowth(rows, head, MAX_SINGLE_COMMIT_GROWTH);
  check(problems.length === 0, 'growth exactly at the cap must not be flagged');
})();

(function growthNeverFlagsAShrink() {
  const rows = [{path: 'big.js', lines: 1500, status: 'warn'}];
  const head = new Map([['big.js', 1700]]);
  const {problems, growths} = evaluateGrowth(rows, head, MAX_SINGLE_COMMIT_GROWTH);
  check(problems.length === 0, 'a shrink must never be flagged as a problem');
  check(growths.length === 1 && growths[0].delta === -200, 'a shrink still surfaces (negative) in the advisory');
})();

(function growthSkipsOkStatusFiles() {
  const rows = [{path: 'small.js', lines: 400, status: 'ok'}];
  const head = new Map([['small.js', 100]]);
  const {problems, growths} = evaluateGrowth(rows, head, MAX_SINGLE_COMMIT_GROWTH);
  check(problems.length === 0 && growths.length === 0, 'ok-status files are neither gated nor reported');
})();

(function growthSkipsNewFiles() {
  const rows = [{path: 'new.js', lines: 1900, status: 'exception'}];
  const head = new Map(); // file absent from HEAD
  const {problems} = evaluateGrowth(rows, head, MAX_SINGLE_COMMIT_GROWTH);
  check(problems.length === 0, 'a file with no committed version is left to the new-exception rule');
})();

process.stdout.write('PASS: source complexity governance model (' + count + ' assertions)\n');
