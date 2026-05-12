#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BUILD_SCRIPT = path.join(__dirname, 'build_project_map.py');
const PROFILE_DIR = path.join(__dirname, 'profiles');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const CURRENT_REPO_PROFILES = ['generic-dendry', 'sdaah-style', 'islands-sunrise'];
const SDAAH_PROFILES = ['generic-dendry', 'sdaah-style'];
const DEFAULT_OUT_DIR = path.join(os.tmpdir(), 'dendry_project_map');

const MIN_FLAGS = new Map([
  ['--min-scenes', 'sceneCount'],
  ['--min-edges', 'edgeCount'],
  ['--min-variables', 'variableCount'],
  ['--min-diagnostics', 'diagnosticCount'],
  ['--min-events', 'eventCount'],
  ['--min-cards', 'cardCount'],
  ['--min-hands', 'handCount'],
  ['--min-decks', 'deckCount'],
  ['--min-pinned-cards', 'pinnedCardCount'],
  ['--min-news-items', 'newsItemCount']
]);

function usage() {
  return [
    'Usage:',
    '  node tools/project_map/check_project_map_fixture.js --generic-mini',
    '  node tools/project_map/check_project_map_fixture.js --sdaah-mini',
    '  node tools/project_map/check_project_map_fixture.js --fixture-root <path> [expectations]',
    '  node tools/project_map/check_project_map_fixture.js --current-repo',
    '  node tools/project_map/check_project_map_fixture.js --sdaah-fixture-root',
    '',
    'Expectations:',
    '  --expect-profiles <a,b>     Require these profiles to be present.',
    '  --exact-profiles <a,b>      Require profileIds to match exactly in order.',
    '  --forbid-profiles <a,b>     Require these profiles to be absent.',
    '  --min-scenes <n>            Minimum summary.sceneCount.',
    '  --min-edges <n>             Minimum summary.edgeCount.',
    '  --min-variables <n>         Minimum summary.variableCount.',
    '  --min-events <n>            Minimum summary.eventCount.',
    '  --min-cards <n>             Minimum summary.cardCount.',
    '  --min-news-items <n>        Minimum summary.newsItemCount.',
    '  --out <path>                Project Map output path; defaults under /tmp.',
    '',
    '--generic-mini and --sdaah-mini are mandatory in-repo cross-profile smoke fixtures.',
    '--current-repo defaults to exact profiles: ' + CURRENT_REPO_PROFILES.join(','),
    '--sdaah-fixture-root reads SDAAH_FIXTURE_ROOT and skips when unset.'
  ].join('\n');
}

function dieUsage(message) {
  process.stderr.write('ERROR: ' + message + '\n\n' + usage() + '\n');
  process.exit(2);
}

function parseCsv(value) {
  if (!value) {
    return [];
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function requireValue(argv, index, flag) {
  if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
    dieUsage(flag + ' requires a value');
  }
  return argv[index + 1];
}

function parseNonNegativeInt(value, flag) {
  if (!/^\d+$/.test(value)) {
    dieUsage(flag + ' requires a non-negative integer');
  }
  return Number(value);
}

function parseArgs(argv) {
  const args = {
    fixtureRoot: null,
    genericMini: false,
    sdaahMini: false,
    currentRepo: false,
    sdaahFixtureRoot: false,
    expectProfiles: [],
    exactProfiles: null,
    forbidProfiles: [],
    minCounts: {},
    exactCounts: {},
    out: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage() + '\n');
      process.exit(0);
    }
    if (arg === '--generic-mini') {
      args.genericMini = true;
    } else if (arg === '--sdaah-mini') {
      args.sdaahMini = true;
    } else if (arg === '--fixture-root') {
      args.fixtureRoot = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === '--current-repo') {
      args.currentRepo = true;
    } else if (arg === '--sdaah-fixture-root') {
      args.sdaahFixtureRoot = true;
    } else if (arg === '--expect-profiles') {
      args.expectProfiles = parseCsv(requireValue(argv, index, arg));
      index += 1;
    } else if (arg === '--exact-profiles') {
      args.exactProfiles = parseCsv(requireValue(argv, index, arg));
      index += 1;
    } else if (arg === '--forbid-profiles') {
      args.forbidProfiles = parseCsv(requireValue(argv, index, arg));
      index += 1;
    } else if (arg === '--out') {
      args.out = requireValue(argv, index, arg);
      index += 1;
    } else if (MIN_FLAGS.has(arg)) {
      const summaryKey = MIN_FLAGS.get(arg);
      args.minCounts[summaryKey] = parseNonNegativeInt(requireValue(argv, index, arg), arg);
      index += 1;
    } else {
      dieUsage('unknown argument: ' + arg);
    }
  }

  const rootModes = [args.genericMini, args.sdaahMini, Boolean(args.fixtureRoot), args.currentRepo, args.sdaahFixtureRoot]
    .filter(Boolean).length;
  if (rootModes !== 1) {
    dieUsage('choose exactly one root mode: --generic-mini, --sdaah-mini, --fixture-root, --current-repo, or --sdaah-fixture-root');
  }

  if (args.genericMini) {
    args.fixtureRoot = path.join(FIXTURE_DIR, 'generic-mini');
    args.exactProfiles = ['generic-dendry'];
    args.forbidProfiles = ['sdaah-style', 'islands-sunrise'];
    args.exactCounts = {
      sceneCount: 2,
      edgeCount: 2,
      variableCount: 1,
      diagnosticCount: 1,
      eventCount: 1,
      cardCount: 0,
      newsItemCount: 0
    };
  }

  if (args.sdaahMini) {
    args.fixtureRoot = path.join(FIXTURE_DIR, 'sdaah-mini');
    args.exactProfiles = ['generic-dendry', 'sdaah-style'];
    args.forbidProfiles = ['islands-sunrise'];
    args.exactCounts = {
      sceneCount: 3,
      edgeCount: 3,
      variableCount: 5,
      diagnosticCount: 0,
      eventCount: 2,
      cardCount: 0,
      newsItemCount: 0
    };
  }

  if (args.currentRepo) {
    args.fixtureRoot = REPO_ROOT;
    if (!args.exactProfiles) {
      args.exactProfiles = CURRENT_REPO_PROFILES;
    }
  }

  if (args.sdaahFixtureRoot) {
    const envRoot = process.env.SDAAH_FIXTURE_ROOT;
    if (!envRoot) {
      process.stdout.write(JSON.stringify({
        ok: true,
        skipped: true,
        reason: 'SDAAH_FIXTURE_ROOT is not set'
      }, null, 2) + '\n');
      process.exit(0);
    }
    args.fixtureRoot = envRoot;
    if (!args.exactProfiles && args.expectProfiles.length === 0) {
      args.exactProfiles = SDAAH_PROFILES;
    }
    if (args.forbidProfiles.length === 0) {
      args.forbidProfiles = ['islands-sunrise'];
    }
  }

  return args;
}

function lintProfileRegexes() {
  const errors = [];
  const regexKeys = new Set([
    'regex',
    'contentRegex',
    'pathRegex',
    'nameRegex',
    'variableRegex',
    'variableNameRegex',
    'forbidWriteVariableRegex',
    'fromPathRegex',
    'expectedDefinitionPathRegex'
  ]);

  function walk(value, trail) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, trail.concat(String(index))));
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }
    Object.entries(value).forEach(([key, child]) => {
      const nextTrail = trail.concat(key);
      if (regexKeys.has(key) && typeof child === 'string') {
        try {
          new RegExp(child);
        } catch (err) {
          errors.push(nextTrail.join('.') + ': ' + err.message);
        }
      }
      walk(child, nextTrail);
    });
  }

  fs.readdirSync(PROFILE_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .forEach((name) => {
      const profilePath = path.join(PROFILE_DIR, name);
      try {
        walk(JSON.parse(fs.readFileSync(profilePath, 'utf8')), [name]);
      } catch (err) {
        errors.push(name + ': ' + err.message);
      }
    });
  return errors;
}

function slugForRoot(root) {
  return path.basename(root).replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '') || 'fixture';
}

function outputPathFor(args, root) {
  if (args.out) {
    return path.resolve(process.cwd(), args.out);
  }
  return path.join(
    DEFAULT_OUT_DIR,
    slugForRoot(root) + '-project-index-' + process.pid + '-' + Date.now() + '.json'
  );
}

function runBuilder(root, outPath) {
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  return spawnSync(
    'python3',
    [BUILD_SCRIPT, '--root', root, '--out', outPath, '--summary'],
    {cwd: REPO_ROOT, encoding: 'utf8'}
  );
}

function readIndex(outPath) {
  const raw = fs.readFileSync(outPath, 'utf8');
  return JSON.parse(raw);
}

function sameArray(actual, expected) {
  return actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);
}

function checkExpectations(index, args) {
  const errors = [];
  const profiles = index.project && Array.isArray(index.project.profileIds)
    ? index.project.profileIds
    : [];
  const summary = index.summary || {};

  args.expectProfiles.forEach((profileId) => {
    if (!profiles.includes(profileId)) {
      errors.push('missing expected profile: ' + profileId);
    }
  });

  if (args.exactProfiles && !sameArray(profiles, args.exactProfiles)) {
    errors.push(
      'profileIds expected exactly [' + args.exactProfiles.join(', ') +
      '], got [' + profiles.join(', ') + ']'
    );
  }

  args.forbidProfiles.forEach((profileId) => {
    if (profiles.includes(profileId)) {
      errors.push('forbidden profile present: ' + profileId);
    }
  });

  Object.entries(args.minCounts).forEach(([summaryKey, minimum]) => {
    const actual = Number(summary[summaryKey] || 0);
    if (actual < minimum) {
      errors.push(summaryKey + ' expected >= ' + minimum + ', got ' + actual);
    }
  });

  Object.entries(args.exactCounts).forEach(([summaryKey, expected]) => {
    const actual = Number(summary[summaryKey] || 0);
    if (actual !== expected) {
      errors.push(summaryKey + ' expected exactly ' + expected + ', got ' + actual);
    }
  });

  return errors;
}

function main() {
  const lintErrors = lintProfileRegexes();
  if (lintErrors.length > 0) {
    process.stderr.write('ERROR: invalid profile regexes:\n' + lintErrors.join('\n') + '\n');
    return 1;
  }

  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), args.fixtureRoot);
  if (!fs.existsSync(path.join(root, 'source', 'info.dry'))) {
    process.stderr.write('ERROR: fixture root does not contain source/info.dry: ' + root + '\n');
    return 1;
  }

  const outPath = outputPathFor(args, root);
  const result = runBuilder(root, outPath);
  if (result.status !== 0) {
    process.stderr.write(JSON.stringify({
      ok: false,
      root,
      out: outPath,
      exitCode: result.status,
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim()
    }, null, 2) + '\n');
    return 1;
  }

  let index;
  try {
    index = readIndex(outPath);
  } catch (err) {
    process.stderr.write('ERROR: could not read Project Map output: ' + err.message + '\n');
    return 1;
  }

  const errors = checkExpectations(index, args);
  const report = {
    ok: errors.length === 0,
    skipped: false,
    root,
    out: outPath,
    profiles: index.project.profileIds,
    summary: {
      scenes: index.summary.sceneCount,
      edges: index.summary.edgeCount,
      variables: index.summary.variableCount,
      diagnostics: index.summary.diagnosticCount,
      events: index.summary.eventCount,
      cards: index.summary.cardCount,
      newsItems: index.summary.newsItemCount
    }
  };

  if (errors.length > 0) {
    report.errors = errors;
    process.stderr.write(JSON.stringify(report, null, 2) + '\n');
    return 1;
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  return 0;
}

process.exitCode = main();
