#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BUDGET_PATH = 'tools/project_map/llm_friendliness_budget.json';

function repoPath(relativePath, root) {
  return path.join(root || ROOT, relativePath);
}

function normalizeRepoPath(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function exists(relativePath, root) {
  return fs.existsSync(repoPath(relativePath, root));
}

function read(relativePath, root) {
  return fs.readFileSync(repoPath(relativePath, root), 'utf8');
}

function listFilesRecursive(dir, prefix) {
  const files = [];
  fs.readdirSync(dir, {withFileTypes: true}).forEach((entry) => {
    if (entry.name === '.git') {
      return;
    }
    const rel = prefix ? prefix + '/' + entry.name : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(full, rel));
    } else if (entry.isFile()) {
      files.push(normalizeRepoPath(rel));
    }
  });
  return files;
}

function parseJson(relativePath, failures, root) {
  try {
    return JSON.parse(read(relativePath, root));
  } catch (error) {
    failures.push({
      code: 'invalid-json',
      path: relativePath,
      message: error.message
    });
    return null;
  }
}

function gitTrackedFiles(root) {
  const repoRoot = root || ROOT;
  const result = spawnSync('git', ['ls-files'], {cwd: repoRoot, encoding: 'utf8'});
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || 'git ls-files failed').trim();
    if (/not a git repository/i.test(message)) {
      return {
        ok: true,
        files: new Set(listFilesRecursive(repoRoot, ''))
      };
    }
    return {
      ok: false,
      files: new Set(),
      message
    };
  }
  return {
    ok: true,
    files: new Set(result.stdout.split(/\r?\n/).filter(Boolean))
  };
}

function splitCommandSegments(script) {
  const segments = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < script.length; index += 1) {
    const char = script[index];
    const next = script[index + 1];
    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ';' || char === '|') {
      if (current.trim()) {
        segments.push(current.trim());
      }
      current = '';
      if (char === '|' && next === '|') {
        index += 1;
      }
      continue;
    }
    if (char === '&' && next === '&') {
      if (current.trim()) {
        segments.push(current.trim());
      }
      current = '';
      index += 1;
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    segments.push(current.trim());
  }
  return segments;
}

function tokenizeCommand(command) {
  const tokens = [];
  let current = '';
  let quote = null;
  let escaped = false;

  function flush() {
    if (current) {
      tokens.push(current);
      current = '';
    }
  }

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      flush();
      continue;
    }
    current += char;
  }
  flush();
  return tokens;
}

function optionConsumesValue(option) {
  return [
    '-r',
    '--require',
    '--loader',
    '--import',
    '--experimental-loader',
    '--env-file'
  ].includes(option);
}

function nodeTargetsFromScript(scriptName, script) {
  if (typeof script !== 'string') {
    return [];
  }
  const targets = [];
  splitCommandSegments(script).forEach((segment) => {
    const tokens = tokenizeCommand(segment);
    tokens.forEach((token, index) => {
      if (token !== 'node') {
        return;
      }
      for (let nextIndex = index + 1; nextIndex < tokens.length; nextIndex += 1) {
        const candidate = tokens[nextIndex];
        if (candidate.startsWith('-')) {
          if (optionConsumesValue(candidate)) {
            nextIndex += 1;
          }
          continue;
        }
        const target = normalizeTargetPath(candidate);
        targets.push({
          script: scriptName,
          target,
          path: target
        });
        break;
      }
    });
  });
  return targets;
}

function normalizeTargetPath(target) {
  return normalizeRepoPath(path.normalize(target.replace(/^\.\/+/, '')));
}

function isExternalReference(value) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(value) ||
    /^[a-z][a-z0-9+.-]*:/i.test(value) ||
    value.startsWith('#');
}

function stripQueryAndHash(value) {
  return value.split(/[?#]/)[0];
}

function resolveLocalReference(baseFile, value) {
  const cleanValue = stripQueryAndHash(value.trim());
  if (!cleanValue || isExternalReference(cleanValue)) {
    return null;
  }
  if (cleanValue.startsWith('/')) {
    return normalizeRepoPath(path.normalize(cleanValue.replace(/^\/+/, '')));
  }
  return normalizeRepoPath(path.normalize(path.join(path.dirname(baseFile), cleanValue)));
}

function htmlLocalReferences(indexPath, html) {
  const refs = [];
  [
    {tag: 'script', attr: 'src'},
    {tag: 'link', attr: 'href'}
  ].forEach((rule) => {
    const tagRegex = new RegExp('<' + rule.tag + '\\b[^>]*\\b' + rule.attr + '\\s*=\\s*([\"\\\'])(.*?)\\1[^>]*>', 'gi');
    let match;
    while ((match = tagRegex.exec(html))) {
      const resolved = resolveLocalReference(indexPath, match[2]);
      if (resolved) {
        refs.push({
          source: indexPath,
          kind: rule.tag + '-' + rule.attr,
          value: match[2],
          path: resolved
        });
      }
    }
  });
  return refs;
}

function cssImportReferences(stylesPath, css) {
  const refs = [];
  const importRegex = /@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^'")\s;]+))\s*\)?/gi;
  let match;
  while ((match = importRegex.exec(css))) {
    const value = match[1] || match[2] || match[3];
    const resolved = resolveLocalReference(stylesPath, value);
    if (resolved) {
      refs.push({
        source: stylesPath,
        kind: 'css-import',
        value,
        path: resolved
      });
    }
  }
  return refs;
}

function validateBudget(budget, failures) {
  if (!budget || typeof budget !== 'object' || Array.isArray(budget)) {
    failures.push({
      code: 'invalid-complexity-budget-shape',
      path: BUDGET_PATH,
      message: 'budget JSON must be an object'
    });
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(budget, 'version')) {
    failures.push({
      code: 'invalid-complexity-budget-version',
      path: BUDGET_PATH,
      message: 'budget JSON must include version'
    });
  }
  if (!Array.isArray(budget.exceptions)) {
    failures.push({
      code: 'invalid-complexity-budget-exceptions',
      path: BUDGET_PATH,
      message: 'budget JSON must include exceptions array'
    });
    return;
  }
  budget.exceptions.forEach((exception, index) => {
    if (!exception || typeof exception.path !== 'string') {
      failures.push({
        code: 'invalid-complexity-budget-exception-path',
        path: BUDGET_PATH,
        index
      });
    }
    if (!exception || !Number.isInteger(exception.maxLines)) {
      failures.push({
        code: 'invalid-complexity-budget-exception-max-lines',
        path: BUDGET_PATH,
        index
      });
    }
  });
}

function appendMissingFailures(references, failures, root, code) {
  references.forEach((reference) => {
    if (!exists(reference.path, root)) {
      failures.push(Object.assign({code}, reference));
    }
  });
}

function appendUntrackedWarnings(references, warnings, trackedFiles, code) {
  const refs = references.filter((reference) => trackedFiles.has(reference.path) === false);
  if (refs.length) {
    warnings.push({code, refs});
  }
}

function runGovernanceParityCheck(options) {
  const root = (options && options.root) || ROOT;
  const failures = [];
  const warnings = [];
  const tracked = gitTrackedFiles(root);
  if (!tracked.ok) {
    failures.push({
      code: 'git-ls-files-failed',
      message: tracked.message
    });
  }

  const rootPackageJson = exists('package.json', root) ?
    parseJson('package.json', failures, root) :
    null;
  const scripts = rootPackageJson && rootPackageJson.scripts ? rootPackageJson.scripts : {};
  const scriptTargets = ['check:ci', 'check:complexity']
    .flatMap((scriptName) => nodeTargetsFromScript(scriptName, scripts[scriptName]));

  appendMissingFailures(scriptTargets, failures, root, 'missing-package-script-node-target');
  appendUntrackedWarnings(
    scriptTargets.filter((reference) => exists(reference.path, root)),
    warnings,
    tracked.files,
    'package-script-node-target-outside-export-file-set'
  );

  const indexPath = 'tools/project_map/viewer/index.html';
  const htmlRefs = exists(indexPath, root) ? htmlLocalReferences(indexPath, read(indexPath, root)) : [];
  appendMissingFailures(htmlRefs, failures, root, 'missing-viewer-index-reference');
  appendUntrackedWarnings(
    htmlRefs.filter((reference) => exists(reference.path, root)),
    warnings,
    tracked.files,
    'viewer-index-reference-outside-export-file-set'
  );

  const stylesPath = 'tools/project_map/viewer/styles.css';
  const cssRefs = exists(stylesPath, root) ? cssImportReferences(stylesPath, read(stylesPath, root)) : [];
  appendMissingFailures(cssRefs, failures, root, 'missing-viewer-styles-import');
  appendUntrackedWarnings(
    cssRefs.filter((reference) => exists(reference.path, root)),
    warnings,
    tracked.files,
    'viewer-styles-import-outside-export-file-set'
  );

  if (scripts['check:complexity']) {
    if (!exists(BUDGET_PATH, root)) {
      failures.push({
        code: 'missing-complexity-budget',
        path: BUDGET_PATH
      });
    } else {
      validateBudget(parseJson(BUDGET_PATH, failures, root), failures);
    }
  }
  if (exists(BUDGET_PATH, root) && !tracked.files.has(BUDGET_PATH)) {
    warnings.push({
      code: 'complexity-budget-outside-export-file-set',
      path: BUDGET_PATH
    });
  }

  return {
    ok: failures.length === 0,
    warnings,
    failures
  };
}

function main() {
  const result = runGovernanceParityCheck();
  if (!result.ok) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify({
    ok: true,
    warnings: result.warnings
  }, null, 2) + '\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  runGovernanceParityCheck
};
