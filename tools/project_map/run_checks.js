#!/usr/bin/env node
'use strict';

// Data-driven runner for the broad CI gate. Reads the ordered `ciSequence`
// from tool_registry.json and runs each command in turn, stopping at the first
// failure and exiting with its status. This keeps the check:ci entry in
// package.json a single command while the actual list stays readable, ordered
// data that check_tool_registry.js and check_governance_parity.js can validate.

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(__dirname, 'tool_registry.json');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function loadSequence() {
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    fail('Could not read tool_registry.json: ' + error.message);
  }
  const sequence = registry.ciSequence;
  if (!Array.isArray(sequence) || sequence.length === 0) {
    fail('tool_registry.json must define a non-empty ciSequence array.');
  }
  sequence.forEach((command, index) => {
    if (typeof command !== 'string' || !command.trim()) {
      fail('ciSequence[' + index + '] must be a non-empty command string.');
    }
  });
  return sequence;
}

function runSequence(sequence) {
  const total = sequence.length;
  for (let index = 0; index < total; index += 1) {
    const command = sequence[index];
    process.stdout.write('\n[' + (index + 1) + '/' + total + '] ' + command + '\n');
    const result = spawnSync(command, {cwd: ROOT, shell: true, stdio: 'inherit'});
    if (result.error) {
      fail('check:ci step ' + (index + 1) + '/' + total + ' could not start: ' + command + ' (' + result.error.message + ')');
    }
    if (result.status !== 0) {
      process.stderr.write('\nFAIL: check:ci step ' + (index + 1) + '/' + total + ' failed: ' + command + '\n');
      process.exit(result.status || 1);
    }
  }
  process.stdout.write('\ncheck:ci OK: ' + total + ' checks passed.\n');
}

function main() {
  const sequence = loadSequence();
  if (process.argv.includes('--list')) {
    process.stdout.write(sequence.join('\n') + '\n');
    return;
  }
  runSequence(sequence);
}

if (require.main === module) {
  main();
}

module.exports = {loadSequence};
