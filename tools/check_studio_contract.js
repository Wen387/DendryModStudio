#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CONTRACT_PATH = path.join(REPO_ROOT, 'studio_contract', 'contract.json');
const CONTRACT_SCHEMA_PATH = path.join(REPO_ROOT, 'studio_contract', 'contract.schema.json');
const FIXTURE_ONLY = process.argv.includes('--fixture-only') ||
  !fs.existsSync(path.join(REPO_ROOT, 'source', 'scenes', 'root.scene.dry'));
const ALLOWED_INSTALL_BOUNDARIES = new Set([
  'safe_apply',
  'guarded_apply',
  'advanced_apply',
  'manual_review',
  'ide_escape_hatch',
  'refused'
]);

function fail(message, details) {
  const report = Object.assign({ok: false, message}, details || {});
  process.stderr.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim() === value && value.length > 0, label + ' must be a non-empty trimmed string');
}

function assertStringArray(value, label) {
  assert(Array.isArray(value) && value.length > 0, label + ' must be a non-empty string array');
  const seen = new Set();
  value.forEach((item) => {
    assertString(item, label + ' item');
    assert(!seen.has(item), label + ' contains duplicate item: ' + item);
    seen.add(item);
  });
}

function assertRelativeRepoPath(value, label) {
  assertString(value, label);
  assert(!path.isAbsolute(value), label + ' must be repository-relative: ' + value);
  assert(!value.split(/[\\/]+/).includes('..'), label + ' must not contain .. segments: ' + value);
}

function arrayIncludesAll(actual, expected, label) {
  expected.forEach((item) => {
    if (!actual.includes(item)) {
      fail(label + ' is missing ' + item, {actual, expected});
    }
  });
}

function sameArray(actual, expected, label) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    fail(label + ' mismatch', {actual, expected});
  }
}

function validateSchemaFile(contract) {
  const schema = readJson(CONTRACT_SCHEMA_PATH);
  assert(schema && schema.type === 'object', 'contract.schema.json must describe an object');
  assert(schema.additionalProperties === false, 'contract.schema.json should refuse unknown top-level fields');
  assert(Array.isArray(schema.required), 'contract.schema.json must define required fields');
  Object.keys(contract).forEach((key) => {
    assert(schema.required.includes(key), 'contract.schema.json should require contract field: ' + key);
  });
  assert(schema.properties && schema.properties.schemaVersion && schema.properties.schemaVersion.const === 1, 'contract.schema.json should lock schemaVersion to 1');
  const installBoundary = schema.properties && schema.properties.installBoundary;
  const enumValues = installBoundary && installBoundary.additionalProperties && installBoundary.additionalProperties.enum || [];
  ALLOWED_INSTALL_BOUNDARIES.forEach((value) => {
    assert(enumValues.includes(value), 'contract.schema.json installBoundary enum missing ' + value);
  });
}

function validateContractShape(contract) {
  assert(isPlainObject(contract), 'contract must be a JSON object');
  assert(contract.schemaVersion === 1, 'contract schemaVersion must be 1');
  assertString(contract.contractId, 'contractId');
  assert(/^\d+\.\d+\.\d+$/.test(contract.contractVersion || ''), 'contractVersion must be semantic version x.y.z');
  assertString(contract.projectName, 'projectName');
  assertString(contract.profileId, 'profileId');
  assertStringArray(contract.profileChain, 'profileChain');
  assertStringArray(contract.requiredInvariants, 'requiredInvariants');
  assertStringArray(contract.stableRouters, 'stableRouters');
  assertStringArray(contract.semanticSystems, 'semanticSystems');
  assertStringArray(contract.variableFamilies, 'variableFamilies');
  assertStringArray(contract.protectedBoundaries, 'protectedBoundaries');
  assertStringArray(contract.protectedPathPrefixes, 'protectedPathPrefixes');
  assertRelativeRepoPath(contract.studioProfilePath, 'studioProfilePath');
  assertRelativeRepoPath(contract.parserFixtureRoot, 'parserFixtureRoot');
  assert(contract.protectedPathPrefixes.includes('out/html/'), 'protectedPathPrefixes should include out/html/');
  assert(isPlainObject(contract.installBoundary), 'installBoundary must be an object');
  Object.entries(contract.installBoundary).forEach(([key, value]) => {
    assertString(key, 'installBoundary key');
    assert(ALLOWED_INSTALL_BOUNDARIES.has(value), 'installBoundary.' + key + ' has unknown boundary: ' + value);
  });

  const expectations = contract.parserFixtureExpectations;
  assert(isPlainObject(expectations), 'parserFixtureExpectations must be an object');
  assertStringArray(expectations.profileIds, 'parserFixtureExpectations.profileIds');
  assertStringArray(expectations.requiredScenes, 'parserFixtureExpectations.requiredScenes');
  assertStringArray(expectations.requiredVariables, 'parserFixtureExpectations.requiredVariables');
  assert(isPlainObject(expectations.minSummary), 'parserFixtureExpectations.minSummary must be an object');
  Object.entries(expectations.minSummary).forEach(([key, value]) => {
    assert(/^[A-Za-z][A-Za-z0-9]*$/.test(key), 'minSummary key should be a summary identifier: ' + key);
    assert(Number.isInteger(value) && value >= 0, 'minSummary.' + key + ' must be a non-negative integer');
  });
}

function validateProfile(contract) {
  const profilePath = path.join(REPO_ROOT, contract.studioProfilePath);
  assert(fs.existsSync(profilePath), 'Studio profile path does not exist: ' + contract.studioProfilePath);
  const profile = readJson(profilePath);
  assert(profile.id === contract.profileId, 'Studio profile id does not match contract profileId');
  assert(profile.extends === 'sdaah-style', 'IslandSunrise profile must extend sdaah-style');
  assert(profile.uiLabels && profile.uiLabels.advisorLikeSingular === 'Circle', 'IslandSunrise profile should label advisor-like singular as Circle');
  assert(profile.uiLabels && profile.uiLabels.advisorLikePlural === 'Circles', 'IslandSunrise profile should label advisor-like plural as Circles');

  const rules = profile.classificationRules || {};
  arrayIncludesAll(
    (rules.semanticSystems || []).map((item) => item.system),
    contract.semanticSystems,
    'profile semantic systems'
  );
  arrayIncludesAll(
    (rules.variableFamilies || []).map((item) => item.family),
    contract.variableFamilies,
    'profile variable families'
  );
  arrayIncludesAll(
    (rules.protectedBoundaries || []).map((item) => item.boundary),
    contract.protectedBoundaries,
    'profile protected boundaries'
  );
}

function validateDocs(contract) {
  [
    'studio_contract/README.md',
    'studio_contract/CHANGE_POLICY.md',
    'studio_contract/authoring_contract.md',
    'studio_contract/compatibility_notes.md',
    'studio_contract/contract.schema.json'
  ].forEach((relativePath) => {
    const text = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert(text.includes(contract.profileId), relativePath + ' should mention profile id');
  });
  if (FIXTURE_ONLY) {
    return;
  }
  const invariants = fs.readFileSync(path.join(REPO_ROOT, 'INVARIANTS.md'), 'utf8');
  contract.requiredInvariants.forEach((code) => {
    assert(invariants.includes(code), 'root INVARIANTS.md should define ' + code);
  });
}

function validateRouterFiles(contract) {
  const fixtureRoot = path.join(REPO_ROOT, contract.parserFixtureRoot);
  contract.stableRouters.forEach((relativePath) => {
    assertRelativeRepoPath(relativePath, 'stableRouters item');
    if (!FIXTURE_ONLY) {
      assert(fs.existsSync(path.join(REPO_ROOT, relativePath)), 'stable router is missing from current game repo: ' + relativePath);
    }
    assert(fs.existsSync(path.join(fixtureRoot, relativePath)), 'stable router is missing from parser fixture: ' + relativePath);
  });
}

function buildFixture(contract) {
  const fixtureRoot = path.join(REPO_ROOT, contract.parserFixtureRoot);
  assert(fs.existsSync(path.join(fixtureRoot, 'source', 'info.dry')), 'parser fixture must contain source/info.dry');
  const outPath = path.join(os.tmpdir(), 'dendry_project_map', 'islands-contract-' + process.pid + '-' + Date.now() + '.json');
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  const result = spawnSync(
    'python3',
    [
      path.join(REPO_ROOT, 'tools', 'project_map', 'build_project_map.py'),
      '--root',
      fixtureRoot,
      '--out',
      outPath,
      '--summary'
    ],
    {cwd: REPO_ROOT, encoding: 'utf8'}
  );
  if (result.status !== 0) {
    fail('parser fixture ProjectIndex build failed', {
      exitCode: result.status,
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim()
    });
  }
  return {index: readJson(outPath), outPath, stdout: (result.stdout || '').trim()};
}

function validateFixture(contract, index) {
  const expectations = contract.parserFixtureExpectations || {};
  const profileIds = index.project && Array.isArray(index.project.profileIds)
    ? index.project.profileIds
    : [];
  sameArray(profileIds, expectations.profileIds || [], 'fixture profileIds');

  const summary = index.summary || {};
  Object.entries(expectations.minSummary || {}).forEach(([key, minValue]) => {
    const actual = Number(summary[key] || 0);
    if (actual < Number(minValue)) {
      fail('fixture summary ' + key + ' below contract minimum', {actual, minValue});
    }
  });

  const sceneIds = (index.scenes || []).map((scene) => scene.id);
  arrayIncludesAll(sceneIds, expectations.requiredScenes || [], 'fixture scenes');

  const variableNames = (index.variables || []).map((variable) => variable.name || variable.id || '').filter(Boolean);
  arrayIncludesAll(variableNames, expectations.requiredVariables || [], 'fixture variables');

  const diagnostics = (index.diagnostics || []).filter((diag) => String(diag.severity || '') === 'error');
  if (diagnostics.length > 0) {
    fail('fixture ProjectIndex should not contain error diagnostics', {diagnostics});
  }
}

function main() {
  const contract = readJson(CONTRACT_PATH);
  validateSchemaFile(contract);
  validateContractShape(contract);
  assert(contract.profileId === 'islands-sunrise', 'contract profileId must be islands-sunrise');
  sameArray(contract.profileChain || [], ['generic-dendry', 'sdaah-style', 'islands-sunrise'], 'contract profileChain');
  validateProfile(contract);
  validateDocs(contract);
  validateRouterFiles(contract);
  const built = buildFixture(contract);
  validateFixture(contract, built.index);
  process.stdout.write(JSON.stringify({
    ok: true,
    contractId: contract.contractId,
    contractVersion: contract.contractVersion,
    mode: FIXTURE_ONLY ? 'fixture-only' : 'game-repo',
    fixtureOut: built.outPath,
    profileIds: built.index.project.profileIds,
    summary: built.index.summary
  }, null, 2) + '\n');
}

main();
