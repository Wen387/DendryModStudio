#!/usr/bin/env node
'use strict';

const path = require('path');

function cliLibRoot(cliPath) {
  const resolved = path.resolve(String(cliPath || ''));
  return path.resolve(path.dirname(resolved), '..');
}

function requireDendryModule(cliPath, relativePath, packagePath) {
  if (cliPath) {
    return require(path.join(cliLibRoot(cliPath), relativePath));
  }
  return require(packagePath);
}

function normalizeParserFilename(filename) {
  return String(filename || '').replace(/\\/g, '/');
}

function patchDendryFilenameParsing(cliPath) {
  const dryParser = requireDendryModule(cliPath, path.join('parsers', 'dry.js'), 'dendrynexus/lib/parsers/dry');
  if (dryParser.__dmsWindowsPathPatch) {
    return false;
  }
  const original = dryParser.parseFromContent;
  dryParser.parseFromContent = function parseFromContentWithPosixFilename(filename, content, callback) {
    return original.call(this, normalizeParserFilename(filename), content, callback);
  };
  dryParser.__dmsWindowsPathPatch = true;
  return true;
}

function parseCommandArgs(command, argv) {
  const args = {
    command,
    project: undefined,
    force: false,
    template: undefined,
    pretty: false,
    overwrite: false,
    indent: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-f' || arg === '--force') {
      args.force = true;
      continue;
    }
    if (arg === '-i' || arg === '--indent') {
      args.indent = true;
      continue;
    }
    if (arg === '--pretty') {
      args.pretty = true;
      continue;
    }
    if (arg === '--overwrite') {
      args.overwrite = true;
      continue;
    }
    if (arg === '-t' || arg === '--template') {
      if (index + 1 >= argv.length || String(argv[index + 1] || '').startsWith('-')) {
        throw new Error(arg + ' requires a value');
      }
      args.template = argv[index + 1];
      index += 1;
      continue;
    }
    if (String(arg || '').startsWith('-')) {
      throw new Error('Unsupported Dendry CLI option for Studio runner: ' + arg);
    }
    if (args.project) {
      throw new Error('Studio runner supports only one Dendry project argument.');
    }
    args.project = arg;
  }
  return args;
}

function commandModulePath(command) {
  if (!/^[a-z0-9-]+$/.test(command)) {
    throw new Error('Unsupported Dendry CLI command: ' + command);
  }
  if (command !== 'make-html' && command !== 'compile') {
    throw new Error('Unsupported Dendry CLI command for Studio runner: ' + command);
  }
  return path.join('cli', 'cmd', command + '.js');
}

function runCli(argv, env) {
  const rawArgv = Array.isArray(argv) ? argv.slice() : [];
  const command = rawArgv.shift();
  if (!command) {
    throw new Error('Missing Dendry CLI command.');
  }
  const cliPath = env && env.DMS_DENDRY_CLI_PATH ? env.DMS_DENDRY_CLI_PATH : '';
  try {
    require('colors');
  } catch (_err) {
    // Colors is cosmetic; Dendry commands still work without patched strings.
  }
  patchDendryFilenameParsing(cliPath);
  const commandModule = requireDendryModule(cliPath, commandModulePath(command), 'dendrynexus/lib/cli/cmd/' + command);
  const args = parseCommandArgs(command, rawArgv);
  return new Promise((resolve) => {
    commandModule.cmd.run(args, (err) => {
      if (err) {
        process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
        resolve(1);
        return;
      }
      resolve(0);
    });
  });
}

if (require.main === module) {
  runCli(process.argv.slice(2), process.env).then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    process.exitCode = 1;
  });
}

module.exports = {
  cliLibRoot,
  normalizeParserFilename,
  patchDendryFilenameParsing,
  parseCommandArgs,
  runCli
};
