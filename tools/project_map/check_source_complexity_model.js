#!/usr/bin/env node
'use strict';

// Regression guard for check_source_complexity.js budget governance:
//  - evaluateNoRaise: a frozen ceiling (no "allowRaise": true) may only fall.
//  - evaluateGrowth: an already-large (warn/exception) file may grow by at most
//    MAX_SINGLE_COMMIT_GROWTH lines versus its committed (HEAD) size in a single
//    commit. New files (no committed line count) and shrinks are never flagged;
//    ok-status files are not gated at all.
//  - growthExemption (the reviewed per-case escape hatch): only an
//    extraction-BLOCKED file may carry one, it must hold a dated reason, and it
//    only bypasses the gate while FRESH (rewritten in this commit); a stale
//    exemption does not bypass and is called out.

const fs = require('fs');
const os = require('os');
const path = require('path');
const {assert} = require('./check_harness.js');
const {
  evaluateNoRaise,
  evaluateGrowth,
  loadBudget,
  parseExtractionBlockedPaths,
  evaluateExemptionPlacement,
  growthExemptionState,
  MAX_SINGLE_COMMIT_GROWTH
} = require('./check_source_complexity');

let count = 0;
function check(condition, message) {
  count += 1;
  assert(condition, message);
}

// --- evaluateNoRaise: frozen ceilings may only fall ---

(function noRaiseFlagsAnIncrease() {
  const budget = {exceptions: new Map([['a.js', {maxLines: 120}]])};
  const committed = new Map([['a.js', {maxLines: 110}]]);
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
  const committed = new Map([['a.js', {maxLines: 100}], ['b.js', {maxLines: 120}]]);
  const problems = evaluateNoRaise(budget, committed);
  check(problems.length === 0, 'equal and lowered ceilings must not be flagged');
})();

(function noRaiseRespectsAllowRaise() {
  const budget = {exceptions: new Map([['a.js', {maxLines: 200, allowRaise: true}]])};
  const committed = new Map([['a.js', {maxLines: 100}]]);
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

// --- growthExemption: reviewed per-case bypass, BLOCKED files only ---

(function blockedRegistryParsesArchitectureLines() {
  const markdown = [
    '1. **`viewer/preview_object_editor.js` (~4970)** — safest first: extract siblings.',
    '2. **`viewer/object_authoring_canvas_ui.js` (~4734)** — BLOCKED: the whole file is',
    '   a single closure.',
    'The growth gate is described below; blocked is lowercase here.'
  ].join('\n');
  const blocked = parseExtractionBlockedPaths(markdown);
  check(blocked.has('tools/project_map/viewer/object_authoring_canvas_ui.js'), 'a backticked path on a BLOCKED line should register');
  check(!blocked.has('tools/project_map/viewer/preview_object_editor.js'), 'a path without BLOCKED on its line must not register');
  check(blocked.size === 1, 'lowercase "blocked" and pathless lines must not register anything');
})();

(function exemptionPlacementRequiresBlockedRegistration() {
  const budget = {exceptions: new Map([
    ['blocked.js', {maxLines: 5000, growthExemption: '2026-06-10: reviewed jump'}],
    ['free.js', {maxLines: 2000, growthExemption: '2026-06-10: sneaky jump'}],
    ['plain.js', {maxLines: 2000}]
  ])};
  const problems = evaluateExemptionPlacement(budget, new Set(['blocked.js']));
  check(problems.length === 1, 'only the non-registered exemption should be a problem');
  check(problems[0].kind === 'exemption-not-blocked' && problems[0].row.path === 'free.js', 'the problem should name the ineligible file');
})();

(function exemptionStateFreshOnlyWhenTextChanged() {
  const budget = {exceptions: new Map([
    ['blocked.js', {maxLines: 5000, growthExemption: '2026-06-10: approve jump'}],
    ['stale.js', {maxLines: 5000, growthExemption: '2026-06-01: old approval'}],
    ['free.js', {maxLines: 2000, growthExemption: '2026-06-10: ineligible'}],
    ['plain.js', {maxLines: 2000}]
  ])};
  const committed = new Map([
    ['blocked.js', {maxLines: 5000, growthExemption: null}],
    ['stale.js', {maxLines: 5000, growthExemption: '2026-06-01: old approval'}]
  ]);
  const blocked = new Set(['blocked.js', 'stale.js']);
  const state = growthExemptionState(budget, committed, blocked);
  check(state.get('blocked.js') === 'fresh', 'an exemption written in this commit is fresh');
  check(state.get('stale.js') === 'stale', 'an exemption identical to HEAD is stale');
  check(!state.has('free.js'), 'an ineligible file gets no exemption state at all');
  check(!state.has('plain.js'), 'entries without an exemption get no state');
  const noGit = growthExemptionState(budget, null, blocked);
  check(noGit.get('stale.js') === 'fresh', 'without a committed baseline an exemption counts as fresh (the gate is skipped then anyway)');
})();

(function growthHonorsAFreshExemption() {
  const rows = [{path: 'blocked.js', lines: 5000, status: 'exception'}];
  const head = new Map([['blocked.js', 5000 - (MAX_SINGLE_COMMIT_GROWTH + 100)]]);
  const state = new Map([['blocked.js', 'fresh']]);
  const {problems, growths} = evaluateGrowth(rows, head, MAX_SINGLE_COMMIT_GROWTH, state);
  check(problems.length === 0, 'a fresh exemption should let the oversized growth through');
  check(growths.length === 1 && growths[0].exempted === true, 'the exempted growth must still surface, tagged, in the advisory');
})();

(function growthRejectsAStaleExemption() {
  const rows = [{path: 'blocked.js', lines: 5000, status: 'exception'}];
  const head = new Map([['blocked.js', 5000 - (MAX_SINGLE_COMMIT_GROWTH + 100)]]);
  const state = new Map([['blocked.js', 'stale']]);
  const {problems, growths} = evaluateGrowth(rows, head, MAX_SINGLE_COMMIT_GROWTH, state);
  check(problems.length === 1 && problems[0].kind === 'growth-exceeded', 'a stale exemption must not bypass the gate');
  check(problems[0].staleExemption === true, 'the problem should flag the stale exemption so the message can say re-approve');
  check(growths.length === 1 && growths[0].exempted === false, 'a rejected growth is not advisory-tagged as exempted');
})();

(function exemptionDoesNotLoosenSmallGrowthOrOtherFiles() {
  const rows = [
    {path: 'blocked.js', lines: 5000, status: 'exception'},
    {path: 'other.js', lines: 1900, status: 'exception'}
  ];
  const head = new Map([
    ['blocked.js', 5000 - MAX_SINGLE_COMMIT_GROWTH],
    ['other.js', 1900 - (MAX_SINGLE_COMMIT_GROWTH + 1)]
  ]);
  const state = new Map([['blocked.js', 'fresh']]);
  const {problems} = evaluateGrowth(rows, head, MAX_SINGLE_COMMIT_GROWTH, state);
  check(problems.length === 1 && problems[0].row.path === 'other.js', 'one file\'s exemption must not leak to another file');
})();

(function loadBudgetValidatesExemptionShape() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_budget_model_'));
  const write = (value) => {
    const file = path.join(dir, 'budget.json');
    fs.writeFileSync(file, JSON.stringify({version: 1, exceptions: [Object.assign({path: 'a.js', maxLines: 100}, value)]}));
    return file;
  };
  try {
    const ok = loadBudget(write({growthExemption: '2026-06-10: reviewed oversized growth for the blocked orchestrator'}));
    check(ok.exceptions.get('a.js').growthExemption.indexOf('2026-06-10') === 0, 'a dated reason string should load');
    let undatedRejected = false;
    try {
      loadBudget(write({growthExemption: 'because I said so'}));
    } catch (error) {
      undatedRejected = /growthExemption/.test(error.message);
    }
    check(undatedRejected, 'an exemption without an ISO date must be rejected');
    let nonStringRejected = false;
    try {
      loadBudget(write({growthExemption: true}));
    } catch (error) {
      nonStringRejected = /growthExemption/.test(error.message);
    }
    check(nonStringRejected, 'a non-string exemption must be rejected');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
})();

process.stdout.write('PASS: source complexity governance model (' + count + ' assertions)\n');
