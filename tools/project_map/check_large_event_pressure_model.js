#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const objectCanvasModel = require('./authoring/object_authoring_canvas_model.js');
const complexAuthoring = require('./authoring/complex_event_authoring_model.js');
const previewEditor = require('./viewer/preview_object_editor.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_MAP_ROOT = __dirname;
const DEFAULT_DYNAMIC_ROOT = path.join(REPO_ROOT, 'SDAAHdynamic', 'dynamic_social_democracy-main');
const DYNAMIC_ROOT = path.resolve(process.env.DMS_DYNAMIC_FIXTURE_ROOT || process.env.DMS_SDAAH_FIXTURE_ROOT || DEFAULT_DYNAMIC_ROOT);
const EXISTING_INDEX = process.env.DMS_LARGE_EVENT_PRESSURE_INDEX || '';

const PRESSURE_PROBES = [
  {id: 'presidential_election_1932_campaign', reason: 'large_menu_loop_and_route_order'},
  {id: 'unemployment_insurance_1', reason: 'large_consequence_set'},
  {id: 'death_of_hindenburg_president', reason: 'dynamic_q_and_script_boundary'},
  {id: 'center_party_conference', reason: 'mixed_inline_conditionals'},
  {id: 'dnf_collapse_center_right_coalition', reason: 'follow_up_menu_and_owned_choices'},
  {id: 'blutmai', reason: 'section_owned_options_and_real_branch_entrypoints'}
];
const MAX_TRIAL_PATHS = 3;
const MAX_TRIAL_CHOICES = 4;

function fail(message, detail) {
  process.stderr.write('FAIL: ' + message + (detail ? '\n' + JSON.stringify(detail, null, 2) : '') + '\n');
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildDynamicIndex() {
  if (EXISTING_INDEX && fs.existsSync(EXISTING_INDEX)) {
    return {outPath: EXISTING_INDEX, root: DYNAMIC_ROOT, index: readJson(EXISTING_INDEX), reused: true};
  }
  assert(fs.existsSync(path.join(DYNAMIC_ROOT, 'source', 'info.dry')), 'Dynamic pressure fixture should contain source/info.dry', {
    root: DYNAMIC_ROOT,
    env: 'Set DMS_DYNAMIC_FIXTURE_ROOT or DMS_SDAAH_FIXTURE_ROOT to another checkout if needed.'
  });
  const outPath = path.join(os.tmpdir(), 'dms_large_event_pressure_index.json');
  const args = [
    path.join(PROJECT_MAP_ROOT, 'build_project_map.py'),
    '--root', DYNAMIC_ROOT,
    '--out', outPath,
    '--summary',
    '--include-excerpts',
    '--excerpt-context-lines', '2'
  ];
  const result = childProcess.spawnSync('python3', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  assert(result.status === 0, 'Dynamic ProjectIndex build should succeed', {
    stdout: result.stdout,
    stderr: result.stderr
  });
  return {outPath, root: DYNAMIC_ROOT, index: readJson(outPath), reused: false, stdout: result.stdout};
}

function runLargeEventPressureModel() {
  const fixture = buildDynamicIndex();
  const index = fixture.index || {};
  const ranked = rankEvents(index);
  const selected = selectPressureEvents(index, ranked);
  assert(selected.length >= 4, 'Large-event pressure run needs at least four event probes', selected);
  const probes = selected.map((row) => probeEvent(index, row));
  probes.forEach((probe) => {
    assert(probe.opened, 'Pressure event should open in Existing Event editor', probe);
    assert(probe.rendered, 'Pressure event should render in preview editor', probe);
    assert(probe.sections + probe.options > 0, 'Pressure event should expose editable sections or options', probe);
    assert(probe.structureActions > 0, 'Pressure event should expose structure/edit actions', probe);
    assert(probe.recommendedNextAction, 'Pressure event should report a recommended next action', probe);
  });
  assert(probes.reduce((sum, probe) => sum + probe.routeErrors, 0) === 0, 'Large-event route evidence should not leave unresolved route errors', probes);
  assert(probes.some((probe) => probe.trialOk), 'Large-event pressure should produce at least one runnable representative trial path', probes);
  assert(probes.some((probe) => probe.largeDetailsBounded), 'Large-event pressure should exercise bounded large-detail editor rendering', probes);
  const report = {
    ok: true,
    kind: 'large_event_pressure_model',
    fixture: {
      root: fixture.root,
      outPath: fixture.outPath,
      reusedIndex: fixture.reused,
      scenes: ensureArray(index.scenes).length,
      events: ensureArray(index.semantic && index.semantic.events).length
    },
    selected: probes,
    topCandidates: ranked.slice(0, 10).map(compactRankedEvent),
    summary: {
      probed: probes.length,
      opened: probes.filter((probe) => probe.opened).length,
      rendered: probes.filter((probe) => probe.rendered).length,
      trialOk: probes.filter((probe) => probe.trialOk).length,
      totalOptions: probes.reduce((sum, probe) => sum + probe.options, 0),
      totalSections: probes.reduce((sum, probe) => sum + probe.sections, 0),
      totalRouteEvidence: probes.reduce((sum, probe) => sum + probe.routeEvidence, 0),
      totalScriptBlocks: probes.reduce((sum, probe) => sum + probe.scriptBlocks, 0),
      manualScriptBlocks: probes.reduce((sum, probe) => sum + probe.manualScriptBlocks, 0),
      advancedScriptBlocks: probes.reduce((sum, probe) => sum + probe.advancedScriptBlocks, 0),
      opaqueJsBlocks: probes.reduce((sum, probe) => sum + probe.opaqueJsBlocks, 0),
      scriptCategoryCounts: mergeCountObjects(probes.map((probe) => probe.scriptCategoryCounts)),
      manualScriptCategories: mergeCountObjects(probes.map((probe) => probe.manualScriptCategories)),
      routeErrors: probes.reduce((sum, probe) => sum + probe.routeErrors, 0),
      largestRenderedHtml: Math.max.apply(null, probes.map((probe) => probe.renderedHtmlBytes)),
      highRenderWeight: probes.filter((probe) => probe.renderWeight === 'high').length,
      boundedLargeDetails: probes.filter((probe) => probe.largeDetailsBounded).length
    }
  };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  return report;
}

function rankEvents(index) {
  const scenes = ensureArray(index && index.scenes).filter((scene) => scene && scene.type === 'event');
  const events = new Set(ensureArray(index && index.semantic && index.semantic.events).map((event) => event && event.id).filter(Boolean));
  const parserEvidence = index && index.semantic && index.semantic.parserEvidence || {};
  const routeOrderByPath = countByPath(parserEvidence.routeOrderGroups);
  const dynamicQByPath = countByPath(parserEvidence.dynamicKeyEvidence);
  const effectByPath = countByPath(parserEvidence.effectClauses);
  return scenes
    .filter((scene) => events.has(scene.id))
    .map((scene) => {
      const sourcePath = stringValue(scene.path || scene.sourceSpan && scene.sourceSpan.path);
      const sections = ensureArray(scene.sections).length;
      const options = countSceneOptions(scene);
      const routes = countSceneRoutes(scene) + (routeOrderByPath[sourcePath] || 0);
      const dynamicQ = dynamicQByPath[sourcePath] || 0;
      const effects = Math.max(ensureArray(scene.effects).length, effectByPath[sourcePath] || 0);
      const assets = ensureArray(scene.assetRefs).length;
      const opaqueJs = ensureArray(scene.opaqueJsBlocks).length;
      const lines = sourceLineCount(scene.sourceSpan);
      const score = lines + sections * 20 + options * 25 + routes * 16 + dynamicQ * 45 + effects * 2 + assets * 10 + opaqueJs * 35;
      return {
        id: scene.id,
        title: stringValue(scene.title || scene.name || scene.id),
        path: sourcePath,
        score,
        lines,
        sections,
        options,
        routes,
        effects,
        dynamicQ,
        opaqueJs,
        assets
      };
    })
    .sort((a, b) => b.score - a.score || b.lines - a.lines || a.id.localeCompare(b.id));
}

function selectPressureEvents(index, ranked) {
  const rankedById = new Map(ranked.map((row) => [row.id, row]));
  const selected = [];
  PRESSURE_PROBES.forEach((probe) => {
    const row = rankedById.get(probe.id);
    if (row) {
      selected.push(Object.assign({}, row, {probeReason: probe.reason}));
    }
  });
  ranked.forEach((row) => {
    if (selected.length >= PRESSURE_PROBES.length) {
      return;
    }
    if (!selected.some((item) => item.id === row.id)) {
      selected.push(Object.assign({}, row, {probeReason: 'top_ranked_fallback'}));
    }
  });
  return selected;
}

function probeEvent(index, row) {
  const started = Date.now();
  const model = objectCanvasModel.buildExistingCanvas(index, 'events', row.id, {});
  const buildMs = Date.now() - started;
  const body = model && model.eventBody || {};
  const renderStarted = Date.now();
  const html = model && model.ok ? previewEditor.render(model) : '';
  const renderedHtmlBytes = Buffer.byteLength(html, 'utf8');
  const renderMs = Date.now() - renderStarted;
  const trial = runProbeTrial(body);
  const routeSummary = body.routeScriptIntelligence && body.routeScriptIntelligence.summary || {};
  const deferredDetailGroups = countMatches(html, 'data-preview-object-large-deferred=');
  const gaps = pressureGaps({
    body,
    renderedHtmlBytes,
    largeDetailsBounded: deferredDetailGroups > 0,
    routeSummary,
    trial
  });
  const complexSummary = body.complexEventAuthoring && body.complexEventAuthoring.summary || {};
  return {
    id: row.id,
    title: row.title,
    path: row.path,
    reason: row.probeReason,
    opened: Boolean(model && model.ok),
    rendered: html.includes('data-preview-object-editor="true"'),
    buildMs,
    renderMs,
    renderedHtmlBytes,
    renderWeight: renderWeight(renderedHtmlBytes),
    largeDetailsBounded: deferredDetailGroups > 0,
    deferredDetailGroups,
    sourceScore: row.score,
    sourceLines: row.lines,
    sourceOptions: row.options,
    sourceSections: row.sections,
    sourceRoutes: row.routes,
    sourceEffects: row.effects,
    sourceDynamicQ: row.dynamicQ,
    sections: ensureArray(body.sections).length + ensureArray(body.branchSections).length,
    options: ensureArray(body.options).length,
    structureActions: ensureArray(body.structureActions).length,
    choiceUnits: complexSummary.choiceUnitCount || ensureArray(body.choiceUnits).length,
    consequenceGroups: complexSummary.consequenceGroupCount || ensureArray(body.consequenceGroups).length,
    continuationCount: complexSummary.continuationCount || body.continuationMap && body.continuationMap.summary && body.continuationMap.summary.total || 0,
    playabilityIssues: complexSummary.playabilityIssueCount || body.playabilityChecks && ensureArray(body.playabilityChecks.diagnostics).length || 0,
    routeEvidence: routeSummary.routeCount || body.routeEvidenceMap && ensureArray(body.routeEvidenceMap.items).length || 0,
    exactRoutes: routeSummary.exactRoutes || 0,
    parserBackedRoutes: routeSummary.parserBackedRoutes || 0,
    fuzzyRoutes: routeSummary.fuzzyRoutes || 0,
    missingRoutes: routeSummary.missingRoutes || 0,
    routeErrors: routeSummary.errorCount || 0,
    scriptBlocks: routeSummary.scriptBlockCount || body.scriptImpactMap && ensureArray(body.scriptImpactMap.blocks).length || 0,
    guidedScriptBlocks: routeSummary.guidedScriptBlocks || 0,
    manualScriptBlocks: routeSummary.manualScriptBlocks || 0,
    advancedScriptBlocks: routeSummary.advancedScriptBlocks || 0,
    opaqueJsBlocks: routeSummary.opaqueJsBlocks || routeSummary.scriptCategoryCounts && routeSummary.scriptCategoryCounts.opaque_js_block || 0,
    scriptCategoryCounts: routeSummary.scriptCategoryCounts || body.scriptImpactMap && body.scriptImpactMap.categorySummary || {},
    manualScriptCategories: routeSummary.manualScriptCategories || body.scriptImpactMap && body.scriptImpactMap.manualCategorySummary || {},
    advancedScriptCategories: routeSummary.advancedScriptCategories || body.scriptImpactMap && body.scriptImpactMap.advancedCategorySummary || {},
    guidedScriptEdits: routeSummary.guidedScriptEditCount || ensureArray(body.guidedScriptEdits).length,
    trialOk: trial ? trial.ok : null,
    trialBlocked: trial ? trial.blocked : '',
    trialPaths: trial ? trial.paths : 0,
    trialSeededStateKeys: trial ? trial.seededStateKeys : 0,
    primaryGaps: gaps.primaryGaps,
    recommendedNextAction: gaps.recommendedNextAction
  };
}

function runProbeTrial(body) {
  const choices = ensureArray(body && (body.choiceUnits || body.options));
  const paths = planTrialPaths(body, choices);
  if (!paths.length) {
    return null;
  }
  const pathRuns = paths.map((path) => {
    const initialState = seedStateForPaths([path], choices);
    return {
      path,
      initialState,
      trial: complexAuthoring.runTrial(body, {initialState, paths: [path]})
    };
  });
  const trialPaths = pathRuns.reduce((out, run) => out.concat(ensureArray(run.trial && run.trial.paths)), []);
  const blocked = trialPaths.find((pathRow) => !pathRow.ok);
  const seededKeys = unique(pathRuns.reduce((out, run) => out.concat(Object.keys(run.initialState || {})), []));
  return {
    ok: pathRuns.every((run) => run.trial && run.trial.ok),
    paths: trialPaths.length,
    blocked: blocked ? trialBlockedLabel(blocked) : '',
    seededStateKeys: seededKeys.length,
    plannedPaths: paths.map((path) => ({
      name: path.name,
      startSection: path.startSection || '',
      choices: path.choices
    }))
  };
}

function planTrialPaths(body, choices) {
  const rows = ensureArray(choices).filter((choice) => choice && choice.id);
  if (!rows.length) {
    return [];
  }
  const byOwner = groupChoicesByOwner(rows);
  const entrySections = entrySectionsFor(body, byOwner);
  const planned = [];
  entrySections.forEach((section) => {
    const path = buildPathFromSection(body, rows, byOwner, section);
    if (path && path.choices.length) {
      planned.push(path);
    }
  });
  rows.forEach((choice) => {
    if (planned.length >= MAX_TRIAL_PATHS) {
      return;
    }
    const section = ownerSection(choice);
    const path = buildPathFromChoice(body, rows, byOwner, section, choice);
    if (path && path.choices.length && !samePathExists(planned, path)) {
      planned.push(path);
    }
  });
  return planned.slice(0, MAX_TRIAL_PATHS).map((path, index) => Object.assign({}, path, {
    name: path.name || 'probe_path_' + (index + 1)
  }));
}

function groupChoicesByOwner(choices) {
  return ensureArray(choices).reduce((map, choice) => {
    const owner = ownerSection(choice);
    if (!map.has(owner)) {
      map.set(owner, []);
    }
    map.get(owner).push(choice);
    return map;
  }, new Map());
}

function entrySectionsFor(body, byOwner) {
  const out = [];
  if (byOwner.has('')) {
    out.push('');
  }
  ensureArray(body && body.flow && body.flow.edges).forEach((edge) => {
    if (!edge || !['route', 'conditional_route', 'goto'].includes(stringValue(edge.kind))) {
      return;
    }
    const from = endpointKey(body, edge.from);
    const eventId = endpointKey(body, body && body.eventStructure && body.eventStructure.id || body && body.id);
    if (from && eventId && from !== eventId) {
      return;
    }
    const target = resolveSectionId(body, edge.to || edge.targetId || edge.rawTarget, byOwner);
    if (target && byOwner.has(target)) {
      out.push(target);
    }
  });
  ensureArray(body && body.flow && body.flow.nodes).forEach((node) => {
    const id = resolveSectionId(body, node && (node.sectionId || node.id), byOwner);
    if (id && byOwner.has(id)) {
      out.push(id);
    }
  });
  byOwner.forEach((_rows, owner) => {
    if (owner) {
      out.push(owner);
    }
  });
  return unique(out).slice(0, MAX_TRIAL_PATHS);
}

function buildPathFromSection(body, choices, byOwner, section) {
  const first = bestChoiceForSection(byOwner, section);
  if (!first) {
    return null;
  }
  return buildPathFromChoice(body, choices, byOwner, section, first);
}

function buildPathFromChoice(body, choices, byOwner, section, firstChoice) {
  const picked = [];
  const seenSections = new Set();
  let current = stringValue(section);
  let currentChoice = firstChoice;
  for (let depth = 0; depth < MAX_TRIAL_CHOICES; depth += 1) {
    if (!currentChoice || picked.includes(choiceKey(currentChoice))) {
      break;
    }
    picked.push(choiceKey(currentChoice));
    const next = nextSectionForChoice(body, currentChoice, byOwner);
    if (!next || seenSections.has(next)) {
      break;
    }
    seenSections.add(next);
    current = next;
    currentChoice = bestChoiceForSection(byOwner, current);
  }
  return {
    name: 'probe_' + (stringValue(section) || 'root'),
    startSection: stringValue(section),
    choices: picked.filter(Boolean)
  };
}

function bestChoiceForSection(byOwner, section) {
  const rows = ensureArray(byOwner.get(stringValue(section)));
  return rows.find((choice) => !choice.chooseCondition) || rows[0] || null;
}

function nextSectionForChoice(body, choice, byOwner) {
  const continuation = choice && choice.continuation || {};
  const ordered = ensureArray(continuation.orderedRoutes);
  const route = ordered.find((item) => !stringValue(item && item.predicate)) || ordered[0] || {};
  return resolveSectionId(body, route.target || continuation.nextTarget || choice && choice.resultSectionId || choice && choice.rawTargetId, byOwner);
}

function resolveSectionId(body, target, byOwner) {
  const clean = cleanTarget(target);
  if (!clean || clean === 'root') {
    return '';
  }
  if (byOwner && byOwner.has(clean)) {
    return clean;
  }
  const local = clean.split('.').pop();
  if (byOwner && byOwner.has(local)) {
    return local;
  }
  let hit = '';
  if (byOwner) {
    byOwner.forEach((_rows, key) => {
      if (!hit && key && (key === clean || key.split('.').pop() === local)) {
        hit = key;
      }
    });
  }
  if (hit) {
    return hit;
  }
  const eventId = stringValue(body && body.eventStructure && body.eventStructure.id || body && body.id);
  if (eventId && clean.startsWith(eventId + '.')) {
    return clean;
  }
  return clean;
}

function seedStateForPaths(paths, choices) {
  const byKey = new Map(ensureArray(choices).map((choice) => [choiceKey(choice), choice]));
  const state = {};
  ensureArray(paths).forEach((path) => {
    ensureArray(path && path.choices).forEach((id) => {
      const choice = byKey.get(stringValue(id));
      seedConditionState(state, choice && choice.displayCondition);
      seedConditionState(state, choice && choice.chooseCondition);
    });
  });
  return state;
}

function seedConditionState(state, condition) {
  const text = stringValue(condition).trim().replace(/\s+\/\s+/g, ' and ');
  if (!text || /\[\?/.test(text)) {
    return;
  }
  const branch = text.split(/\s+or\s+/i)[0] || '';
  branch.split(/\s+and\s+/i).forEach((rawClause) => seedClause(state, rawClause));
}

function seedClause(state, rawClause) {
  let text = stringValue(rawClause).trim().replace(/^\((.*)\)$/, '$1').trim();
  if (!text) {
    return;
  }
  let negate = false;
  if (/^not\s+/i.test(text)) {
    negate = true;
    text = text.replace(/^not\s+/i, '').trim();
  }
  const match = text.match(/^(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(>=|<=|!=|==|=|>|<)\s*(.+)$/);
  if (!match) {
    state[text.replace(/^Q\./, '')] = negate ? 0 : 1;
    return;
  }
  const key = match[1];
  const op = match[2];
  const value = parseSeedValue(match[3]);
  const valueKey = seedVariableName(match[3]);
  if (negate) {
    state[key] = 0;
    return;
  }
  if (valueKey) {
    seedVariableComparison(state, key, op, valueKey);
    return;
  }
  if (op === '>' || op === '>=') {
    state[key] = Number(value) + (op === '>' ? 1 : 0);
  } else if (op === '<') {
    state[key] = Number(value) - 1;
  } else if (op === '<=') {
    state[key] = Number(value);
  } else if (op === '!=') {
    state[key] = value === 0 ? 1 : 0;
  } else {
    state[key] = value;
  }
}

function parseSeedValue(value) {
  const text = stringValue(value).trim();
  const quoted = text.match(/^['"]([\s\S]*)['"]$/);
  if (quoted) {
    return quoted[1];
  }
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    return Number(text);
  }
  return text || 1;
}

function seedVariableName(value) {
  const text = stringValue(value).trim().replace(/^Q\./, '');
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(text) ? text : '';
}

function seedVariableComparison(state, leftKey, op, rightKey) {
  if (op === '>' || op === '>=') {
    state[leftKey] = op === '>' ? 1 : 0;
    state[rightKey] = 0;
  } else if (op === '<' || op === '<=') {
    state[leftKey] = 0;
    state[rightKey] = op === '<' ? 1 : 0;
  } else if (op === '!=') {
    state[leftKey] = 0;
    state[rightKey] = 1;
  } else {
    state[leftKey] = 1;
    state[rightKey] = 1;
  }
}

function ownerSection(choice) {
  return stringValue(choice && (choice.ownerSectionId || choice.sectionId));
}

function choiceKey(choice) {
  return stringValue(choice && (choice.id || choice.optionId || choice.rawTargetId || choice.label));
}

function samePathExists(paths, candidate) {
  const key = ensureArray(candidate && candidate.choices).join('>');
  return ensureArray(paths).some((path) => ensureArray(path && path.choices).join('>') === key);
}

function trialBlockedLabel(blocked) {
  const step = ensureArray(blocked && blocked.steps).find((row) => row && row.blockedReason);
  if (!step) {
    return stringValue(blocked && (blocked.blockedReason || blocked.name));
  }
  const gated = ensureArray(step.choices).find((choice) => choice && choice.id === step.chosen);
  const condition = stringValue(gated && gated.chooseCondition);
  return [step.blockedReason, step.chosen, condition ? 'gate=' + condition : ''].filter(Boolean).join(': ');
}

function pressureGaps(input) {
  const routeSummary = input && input.routeSummary || {};
  const trial = input && input.trial || {};
  const htmlBytes = Number(input && input.renderedHtmlBytes) || 0;
  const body = input && input.body || {};
  const gaps = [];
  if (Number(routeSummary.errorCount || 0) > 0 || Number(routeSummary.missingRoutes || 0) > 0) {
    gaps.push('route_resolution');
  }
  if (trial && trial.ok === false) {
    gaps.push('trial_blocked');
  }
  if (Number(routeSummary.manualScriptBlocks || 0) > 0) {
    gaps.push('manual_script_boundary');
  }
  if (renderWeight(htmlBytes) === 'high' && !input.largeDetailsBounded) {
    gaps.push('heavy_render');
  }
  if (ensureArray(body && body.structureActions).length === 0) {
    gaps.push('no_structure_actions');
  }
  return {
    primaryGaps: gaps,
    recommendedNextAction: recommendationForGaps(gaps)
  };
}

function recommendationForGaps(gaps) {
  const rows = ensureArray(gaps);
  if (rows.includes('route_resolution')) {
    return 'normalize_or_classify_routes';
  }
  if (rows.includes('trial_blocked')) {
    return 'add_trial_seed_or_explicit_gate_note';
  }
  if (rows.includes('heavy_render')) {
    return 'bound_large_editor_details';
  }
  if (rows.includes('manual_script_boundary')) {
    return 'review_manual_script_patterns';
  }
  if (rows.includes('no_structure_actions')) {
    return 'add_structural_entrypoints';
  }
  return 'ready_for_targeted_authoring_trial';
}

function renderWeight(bytes) {
  if (bytes >= 4 * 1024 * 1024) {
    return 'high';
  }
  if (bytes >= 2 * 1024 * 1024) {
    return 'medium';
  }
  return 'low';
}

function countMatches(value, needle) {
  const text = stringValue(value);
  const target = stringValue(needle);
  if (!text || !target) {
    return 0;
  }
  return text.split(target).length - 1;
}

function mergeCountObjects(objects) {
  return ensureArray(objects).reduce((out, item) => {
    Object.keys(item || {}).forEach((key) => {
      out[key] = (out[key] || 0) + (Number(item[key]) || 0);
    });
    return out;
  }, {});
}

function endpointKey(body, value) {
  const text = cleanTarget(value);
  if (!text) {
    return '';
  }
  const eventId = stringValue(body && body.eventStructure && body.eventStructure.id || body && body.id);
  if (eventId && text.startsWith(eventId + '.')) {
    return text.slice(eventId.length + 1);
  }
  return text.split('.').pop();
}

function cleanTarget(value) {
  return stringValue(value).trim().replace(/^[@#]/, '').replace(/^(?:scene|section|result|option):/i, '');
}

function unique(values) {
  const seen = new Set();
  const out = [];
  ensureArray(values).forEach((value) => {
    const text = stringValue(value);
    if (text && !seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  });
  return out;
}

function countByPath(rows) {
  return ensureArray(rows).reduce((out, row) => {
    const sourcePath = stringValue(row && row.source && row.source.path);
    if (sourcePath) {
      out[sourcePath] = (out[sourcePath] || 0) + 1;
    }
    return out;
  }, {});
}

function countSceneOptions(scene) {
  return ensureArray(scene && scene.options).length + ensureArray(scene && scene.sections)
    .reduce((sum, section) => sum + ensureArray(section && section.options).length, 0);
}

function countSceneRoutes(scene) {
  return countRoutes(scene && scene.routes) + ensureArray(scene && scene.sections)
    .reduce((sum, section) => sum + countRoutes(section && section.routes), 0);
}

function countRoutes(routes) {
  return Object.keys(routes || {}).reduce((sum, key) => {
    const value = routes[key];
    return sum + (Array.isArray(value) ? value.length : value ? 1 : 0);
  }, 0);
}

function sourceLineCount(span) {
  const start = Number(span && span.startLine) || 0;
  const end = Number(span && span.endLine) || start;
  return Math.max(0, end - start + 1);
}

function compactRankedEvent(row) {
  return {
    id: row.id,
    title: row.title,
    score: row.score,
    lines: row.lines,
    sections: row.sections,
    options: row.options,
    routes: row.routes,
    effects: row.effects,
    dynamicQ: row.dynamicQ,
    opaqueJs: row.opaqueJs,
    assets: row.assets
  };
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function stringValue(value) {
  return value === undefined || value === null ? '' : String(value);
}

if (require.main === module) {
  runLargeEventPressureModel();
} else {
  module.exports = {runLargeEventPressureModel, rankEvents};
}
