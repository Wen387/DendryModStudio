#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, 'tool_registry.json');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    fail('Could not read tool registry: ' + error.message);
  }
}

function parseArgs(argv) {
  const args = {json: false, list: false, task: ''};
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      args.json = true;
    } else if (arg === '--list') {
      args.list = true;
    } else if (arg === '--task') {
      args.task = argv[index + 1] || '';
      index += 1;
    } else if (arg.indexOf('--task=') === 0) {
      args.task = arg.slice('--task='.length);
    } else if (arg === '-h' || arg === '--help') {
      args.help = true;
    } else {
      fail('Unknown argument: ' + arg);
    }
  }
  return args;
}

function commandForTool(registry, id) {
  const tool = registry.tools && registry.tools[id];
  if (!tool) {
    fail('Task references unknown tool: ' + id);
  }
  return {
    id,
    command: tool.command,
    cwd: tool.cwd || '.',
    path: tool.path || '',
    kind: tool.kind || '',
    duration: tool.duration || '',
    gate: tool.gate || '',
    requires: Array.isArray(tool.requires) ? tool.requires : [],
    fixture: tool.fixture || '',
    writes: tool.writes || '',
    when: tool.when || ''
  };
}

function selectedTask(registry, taskId) {
  const task = registry.tasks && registry.tasks[taskId];
  if (!task) {
    const known = Object.keys(registry.tasks || {}).sort().join(', ');
    fail('Unknown task "' + taskId + '". Known tasks: ' + known);
  }
  const toolIds = Array.isArray(task.tools) ? task.tools : [];
  return {
    id: taskId,
    label: task.label || taskId,
    summary: task.summary || '',
    expectedDuration: task.expectedDuration || '',
    requires: Array.isArray(task.requires) ? task.requires : [],
    confidence: task.confidence || '',
    boundaries: Array.isArray(task.boundaries) ? task.boundaries : [],
    commands: toolIds.map((id) => commandForTool(registry, id)),
    extraCommands: Array.isArray(task.extraCommands) ? task.extraCommands : [],
    followUps: Array.isArray(task.followUps) ? task.followUps : []
  };
}

function printText(selection) {
  process.stdout.write(selection.label + '\n');
  process.stdout.write('Task: ' + selection.id + '\n');
  if (selection.summary) process.stdout.write('Summary: ' + selection.summary + '\n');
  if (selection.expectedDuration) process.stdout.write('Expected duration: ' + selection.expectedDuration + '\n');
  if (selection.requires.length) process.stdout.write('Requires: ' + selection.requires.join(', ') + '\n');
  if (selection.confidence) process.stdout.write('Confidence: ' + selection.confidence + '\n');
  if (selection.boundaries.length) {
    process.stdout.write('Boundaries:\n');
    selection.boundaries.forEach((boundary) => process.stdout.write('- ' + boundary + '\n'));
  }
  process.stdout.write('Commands:\n');
  selection.commands.forEach((entry, index) => {
    const cwd = entry.cwd && entry.cwd !== '.' ? ' (cwd: ' + entry.cwd + ')' : '';
    process.stdout.write(String(index + 1) + '. ' + entry.command + cwd + '\n');
  });
  if (selection.extraCommands.length) {
    process.stdout.write('Extra commands:\n');
    selection.extraCommands.forEach((entry, index) => {
      const cwd = entry.cwd && entry.cwd !== '.' ? ' (cwd: ' + entry.cwd + ')' : '';
      const purpose = entry.purpose ? ' - ' + entry.purpose : '';
      process.stdout.write(String(index + 1) + '. ' + entry.command + cwd + purpose + '\n');
    });
  }
  if (selection.followUps.length) {
    process.stdout.write('Follow-ups: ' + selection.followUps.join(', ') + '\n');
  }
}

function printTaskList(registry, json) {
  const tasks = Object.keys(registry.tasks || {}).sort().map((id) => {
    const task = registry.tasks[id];
    return {
      id,
      label: task.label || id,
      expectedDuration: task.expectedDuration || '',
      summary: task.summary || ''
    };
  });
  if (json) {
    process.stdout.write(JSON.stringify({tasks}, null, 2) + '\n');
    return;
  }
  tasks.forEach((task) => {
    process.stdout.write(task.id + ' - ' + task.label + '\n');
    if (task.summary) process.stdout.write('  ' + task.summary + '\n');
  });
}

function printHelp() {
  process.stdout.write([
    'Usage:',
    '  node tools/project_map/select_checks.js --list',
    '  node tools/project_map/select_checks.js --task authoring-structural',
    '  node tools/project_map/select_checks.js --task realworld-quick --json'
  ].join('\n') + '\n');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  const registry = readRegistry();
  if (args.list) {
    printTaskList(registry, args.json);
    return;
  }
  if (!args.task) {
    printHelp();
    fail('Missing --task.');
  }
  const selection = selectedTask(registry, args.task);
  if (args.json) {
    process.stdout.write(JSON.stringify(selection, null, 2) + '\n');
  } else {
    printText(selection);
  }
}

if (require.main === module) {
  main();
}
