#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(__dirname, 'tool_registry.json');
const {fail, assert} = require('./check_harness.js');

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    fail('Could not read tool_registry.json: ' + error.message);
  }
}

function walk(dir, predicate, out) {
  fs.readdirSync(dir, {withFileTypes: true}).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, predicate, out);
      return;
    }
    if (predicate(fullPath)) out.push(fullPath);
  });
}

function repoPath(absolutePath) {
  return path.relative(ROOT, absolutePath).replace(/\\/g, '/');
}

function commandStartsWithNode(command) {
  return /^node\s+tools\/project_map\/.+\.js($|\s)/.test(String(command || ''));
}

function main() {
  const registry = readRegistry();
  assert(registry && registry.schemaVersion === '0.1', 'Registry schemaVersion must be 0.1.');
  assert(registry.tasks && typeof registry.tasks === 'object', 'Registry must define tasks.');
  assert(registry.tools && typeof registry.tools === 'object', 'Registry must define tools.');
  assert(Array.isArray(registry.knownChecks), 'Registry must define knownChecks array.');

  const toolIds = Object.keys(registry.tools);
  const taskIds = Object.keys(registry.tasks);
  assert(toolIds.length > 0, 'Registry has no tools.');
  assert(taskIds.length > 0, 'Registry has no tasks.');

  const seenToolPaths = new Map();
  toolIds.forEach((id) => {
    const tool = registry.tools[id];
    assert(tool && typeof tool === 'object', 'Tool ' + id + ' must be an object.');
    assert(tool.command && typeof tool.command === 'string', 'Tool ' + id + ' must define command.');
    assert(tool.kind && typeof tool.kind === 'string', 'Tool ' + id + ' must define kind.');
    assert(tool.gate && typeof tool.gate === 'string', 'Tool ' + id + ' must define gate.');
    assert(tool.duration && typeof tool.duration === 'string', 'Tool ' + id + ' must define duration.');
    assert(tool.fixture && typeof tool.fixture === 'string', 'Tool ' + id + ' must define fixture.');
    assert(tool.writes && typeof tool.writes === 'string', 'Tool ' + id + ' must define writes.');
    assert(Array.isArray(tool.requires), 'Tool ' + id + ' must define requires array.');
    if (tool.path) {
      const absolute = path.join(ROOT, tool.path);
      assert(fs.existsSync(absolute), 'Tool ' + id + ' path does not exist: ' + tool.path);
      if (seenToolPaths.has(tool.path)) {
        fail('Tool path is registered twice: ' + tool.path + ' (' + seenToolPaths.get(tool.path) + ', ' + id + ')');
      }
      seenToolPaths.set(tool.path, id);
    }
    if (tool.path && /\.js$/.test(tool.path) && tool.command.indexOf(tool.path) === -1 && commandStartsWithNode(tool.command)) {
      fail('Tool ' + id + ' command does not reference its path.');
    }
  });

  taskIds.forEach((id) => {
    const task = registry.tasks[id];
    assert(task && typeof task === 'object', 'Task ' + id + ' must be an object.');
    assert(task.label && typeof task.label === 'string', 'Task ' + id + ' must define label.');
    assert(task.summary && typeof task.summary === 'string', 'Task ' + id + ' must define summary.');
    assert(task.expectedDuration && typeof task.expectedDuration === 'string', 'Task ' + id + ' must define expectedDuration.');
    assert(task.confidence && typeof task.confidence === 'string', 'Task ' + id + ' must define confidence.');
    assert(Array.isArray(task.tools), 'Task ' + id + ' must define tools array.');
    assert(task.tools.length > 0, 'Task ' + id + ' must include at least one tool.');
    task.tools.forEach((toolId) => assert(registry.tools[toolId], 'Task ' + id + ' references missing tool ' + toolId + '.'));
    if (id !== 'release') {
      task.tools.forEach((toolId) => {
        const gate = registry.tools[toolId].gate;
        assert(gate !== 'release', 'Non-release task ' + id + ' includes release-only tool ' + toolId + '.');
      });
    }
  });

  const knownChecks = new Set(registry.knownChecks);
  const duplicateKnown = registry.knownChecks.filter((item, index) => registry.knownChecks.indexOf(item) !== index);
  assert(duplicateKnown.length === 0, 'knownChecks contains duplicate entries: ' + duplicateKnown.join(', '));
  registry.knownChecks.forEach((checkPath) => {
    assert(/^tools\/project_map\/check_.+\.js$/.test(checkPath), 'knownChecks entry is not a project_map check: ' + checkPath);
    assert(fs.existsSync(path.join(ROOT, checkPath)), 'knownChecks entry does not exist: ' + checkPath);
  });

  const discovered = [];
  walk(path.join(ROOT, 'tools', 'project_map'), (fullPath) => /^check_.+\.js$/.test(path.basename(fullPath)), discovered);
  const discoveredPaths = discovered.map(repoPath).sort();
  const missing = discoveredPaths.filter((checkPath) => !knownChecks.has(checkPath));
  assert(missing.length === 0, 'Unclassified check files: ' + missing.join(', '));
  const stale = registry.knownChecks.filter((checkPath) => discoveredPaths.indexOf(checkPath) === -1);
  assert(stale.length === 0, 'Stale knownChecks entries: ' + stale.join(', '));

  // ciSequence is the ordered check:ci command list run by run_checks.js. Every
  // `node tools/project_map/check_*.js` target must exist and be classified in
  // knownChecks so the data-driven CI gate cannot reference a stray check.
  assert(Array.isArray(registry.ciSequence), 'Registry must define a ciSequence array.');
  assert(registry.ciSequence.length > 0, 'ciSequence must include at least one command.');
  registry.ciSequence.forEach((command, index) => {
    assert(typeof command === 'string' && command.trim().length > 0,
      'ciSequence[' + index + '] must be a non-empty command string.');
    const match = /^node\s+(tools\/project_map\/check_[^\s]+\.js)(?:$|\s)/.exec(command);
    if (match) {
      assert(fs.existsSync(path.join(ROOT, match[1])), 'ciSequence references a missing check: ' + match[1]);
      assert(knownChecks.has(match[1]), 'ciSequence references an unclassified check (add to knownChecks): ' + match[1]);
    }
  });

  const toolCheckPaths = new Set(toolIds.map((id) => registry.tools[id].path).filter((item) => /^tools\/project_map\/check_.+\.js$/.test(String(item || ''))));
  const unroutedKnownCount = discoveredPaths.filter((checkPath) => !toolCheckPaths.has(checkPath)).length;

  process.stdout.write('Tool registry OK: ' + taskIds.length + ' tasks, ' + toolIds.length + ' tools, ' + discoveredPaths.length + ' known checks, ' + unroutedKnownCount + ' known-unrouted checks, ' + registry.ciSequence.length + ' ci-sequence steps.\n');
}

if (require.main === module) {
  main();
} else {
  module.exports = {runToolRegistryCheck: main};
}
