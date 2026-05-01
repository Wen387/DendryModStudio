#!/usr/bin/env node
'use strict';

const fs = require('fs');
const installPlan = require('./authoring/install_plan.js');

function usage() {
  return [
    'Usage: node tools/project_map/apply_install_plan.js --plan <install-plan.json> --root <project-root> [--apply] [--allow-advanced] [--summary]',
    '',
    'Defaults to dry-run. Use --apply only after reviewing the patch preview and manual operations.',
    'Level 3 advanced operations require --allow-advanced and should be used only after manual review.'
  ].join('\n');
}

function fail(message, code = 1) {
  const err = new Error(message);
  err.exitCode = code;
  throw err;
}

function parseArgs(argv) {
  const args = {apply: false, allowAdvanced: false, summary: false};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage() + '\n');
      process.exit(0);
    }
    if (arg === '--apply') {
      args.apply = true;
      continue;
    }
    if (arg === '--allow-advanced') {
      args.allowAdvanced = true;
      continue;
    }
    if (arg === '--summary') {
      args.summary = true;
      continue;
    }
    if (arg === '--plan' || arg === '--root') {
      if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
        fail(arg + ' requires a value', 2);
      }
      args[arg.slice(2)] = argv[index + 1];
      index += 1;
      continue;
    }
    fail('Unknown argument: ' + arg, 2);
  }
  if (!args.plan || !args.root) {
    fail('Missing required --plan or --root.\n\n' + usage(), 2);
  }
  return args;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail('Could not read JSON from ' + filePath + ': ' + err.message);
  }
}

function runCli(argv, io) {
  const streams = io || process;
  let args;
  try {
    args = parseArgs(argv || []);
  } catch (err) {
    streams.stderr.write('ERROR: ' + err.message + '\n');
    return err.exitCode || 1;
  }
  const plan = readJson(args.plan);
  const result = installPlan.applyInstallPlan(plan, {
    projectRoot: args.root,
    dryRun: !args.apply,
    allowAdvanced: args.allowAdvanced
  });

  if (args.summary) {
    streams.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    streams.stdout.write([
      result.ok ? 'ok: true' : 'ok: false',
      'mode: ' + (result.dryRun ? 'dry-run' : 'apply'),
      'safe apply: ' + (result.operationSummary ? result.operationSummary.safeApply : 0),
      'guarded install: ' + (result.operationSummary ? result.operationSummary.guardedApply || 0 : 0),
      'advanced install: ' + (result.operationSummary ? result.operationSummary.advancedApply || 0 : 0),
      'manual review: ' + (result.operationSummary ? result.operationSummary.manualReview : 0),
      'protected / refused: ' + (result.operationSummary ? result.operationSummary.refused : 0),
      'operations: ' + result.results.length,
      'diagnostics: ' + result.diagnostics.length
    ].join('\n') + '\n');
  }
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = runCli(process.argv.slice(2), process);
  } catch (err) {
    process.stderr.write('ERROR: ' + err.message + '\n');
    process.exitCode = err.exitCode || 1;
  }
}

module.exports = {runCli, parseArgs};
