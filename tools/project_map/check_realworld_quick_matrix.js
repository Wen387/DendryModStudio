#!/usr/bin/env node
'use strict';

const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const {fail} = require('./check_harness.js');

async function runDirectCheck(id, command, fn) {
  const started = Date.now();
  const originalWrite = process.stdout.write;
  let stdout = '';
  process.stdout.write = function capture(chunk, encoding, callback) {
    stdout += String(chunk || '');
    if (typeof callback === 'function') {
      callback();
    }
    return true;
  };
  try {
    const value = await fn();
    if (!stdout.trim() && value) {
      stdout = JSON.stringify(value, null, 2) + '\n';
    }
    return {
      id,
      command,
      ok: true,
      durationMs: Date.now() - started,
      timedOut: false,
      stdout: stdout.trim(),
      stderr: '',
      error: ''
    };
  } catch (error) {
    return {
      id,
      command,
      ok: false,
      durationMs: Date.now() - started,
      timedOut: false,
      stdout: stdout.trim(),
      stderr: error && error.stack ? error.stack : String(error),
      error: error && error.message ? error.message : String(error)
    };
  } finally {
    process.stdout.write = originalWrite;
  }
}

function parseJsonOutput(run) {
  const text = String(run && run.stdout || '').trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_err) {
    const start = text.lastIndexOf('\n{');
    if (start >= 0) {
      try {
        return JSON.parse(text.slice(start + 1));
      } catch (__err) {
        return null;
      }
    }
    return null;
  }
}

function pushFamily(families, family, status, evidence, source) {
  families.push({
    family,
    status,
    evidence,
    source
  });
}

function summarizeFamilies(families) {
  return families.reduce((summary, row) => {
    const status = row.status || 'unknown';
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});
}

async function main() {
  const started = Date.now();
  const runs = [
    await runDirectCheck('tool-registry', 'node tools/project_map/check_tool_registry.js', () => require('./check_tool_registry.js').runToolRegistryCheck()),
    await runDirectCheck('source-structure-graph', 'node tools/project_map/check_source_structure_graph_model.js', () => {
      const modulePath = require.resolve('./check_source_structure_graph_model.js');
      delete require.cache[modulePath];
      require(modulePath);
      return null;
    }),
    await runDirectCheck('route-editor-workflow', 'node tools/project_map/check_route_editor_workflow_model.js', () => {
      const modulePath = require.resolve('./check_route_editor_workflow_model.js');
      delete require.cache[modulePath];
      require(modulePath);
      return null;
    }),
    await runDirectCheck('route-script-intelligence', 'node tools/project_map/check_route_script_intelligence_model.js', () => require('./check_route_script_intelligence_model.js').runRouteScriptIntelligence()),
    await runDirectCheck('effect-clause-workflow', 'node tools/project_map/check_effect_clause_editor_workflow_model.js', () => {
      const modulePath = require.resolve('./check_effect_clause_editor_workflow_model.js');
      delete require.cache[modulePath];
      require(modulePath);
      return null;
    }),
    await runDirectCheck('complex-event-authoring-flow', 'node tools/project_map/check_complex_event_authoring_flow_model.js', () => require('./check_complex_event_authoring_flow_model.js').runComplexEventAuthoringFlow()),
    await runDirectCheck('existing-event-roundtrip', 'node tools/project_map/check_existing_event_roundtrip_model.js', () => require('./check_existing_event_roundtrip_model.js').runExistingEventRoundtrip()),
    await runDirectCheck('new-event-roundtrip', 'node tools/project_map/check_starter_demo_complex_event_create_model.js', () => require('./check_starter_demo_complex_event_create_model.js').runStarterDemoComplexEventCreate())
  ];
  const failed = runs.filter((run) => !run.ok);
  if (failed.length) {
    fail('Real-world quick matrix dependency failed.', failed.map((run) => ({
      id: run.id,
      command: run.command,
      timedOut: run.timedOut,
      error: run.error,
      stderr: run.stderr.slice(0, 1200)
    })));
  }

  const existingRoundtrip = parseJsonOutput(runs.find((run) => run.id === 'existing-event-roundtrip'));
  const newRoundtrip = parseJsonOutput(runs.find((run) => run.id === 'new-event-roundtrip'));
  const families = [];

  pushFamily(families, 'tool_routing', 'supported', 'registry and selector guard are available', 'check_tool_registry');
  pushFamily(families, 'source_structure_graph', 'supported', 'source graph synthetic suite passed', 'check_source_structure_graph_model');
  pushFamily(families, 'branch_delete_bundle', 'advanced', 'synthetic graph suite covers referenced/nested/incoming-go-to branch bundles', 'check_source_structure_graph_model');
  pushFamily(families, 'reroute_layer', 'advanced', 'synthetic graph suite covers exact incoming go-to retargeting', 'check_source_structure_graph_model');
  pushFamily(families, 'route_order_guided_bundle', 'advanced', 'Route Editor composes parser-backed multi-clause route-order replacements without dropping fallback clauses', 'check_route_editor_workflow_model');
  pushFamily(families, 'route_evidence_intelligence', 'supported', 'Route/script intelligence classifies exact, parser-backed, fuzzy, script-derived, missing, terminal, and external route evidence', 'check_route_script_intelligence_model');
  pushFamily(families, 'script_impact_map', 'supported', 'Route/script intelligence reports script reads, writes, influence, safety class, and boundary reasons', 'check_route_script_intelligence_model');
  pushFamily(families, 'guided_safe_script_edit', 'guarded', 'Route/script intelligence composes guided replacements for simple state assignments and leaves complex JS as manual boundary', 'check_route_script_intelligence_model');
  pushFamily(families, 'opaque_js_boundary_lens', 'manual_boundary', 'Route/script intelligence keeps raw {! ... !} JS visible as explicit manual boundary evidence with read/write hints', 'check_route_script_intelligence_model');
  pushFamily(families, 'effect_clause_guided_bundle', 'advanced', 'Effect Clause Editor composes multi-effect line replacements and preserves hook-prefixed bare syntax', 'check_effect_clause_editor_workflow_model');
  pushFamily(families, 'complex_choice_unit', 'supported', 'Complex event authoring flow exposes full choice units with conditions, unavailable text, consequences, continuation, and evidence', 'check_complex_event_authoring_flow_model');
  pushFamily(families, 'complex_consequence_grouping', 'supported', 'Complex event authoring flow groups public/government/election consequences while preserving raw effects', 'check_complex_event_authoring_flow_model');
  pushFamily(families, 'complex_lightweight_trial_run', 'supported', 'Complex event authoring flow walks two player-like paths and reports unavailable choices, consequences, and next locations', 'check_complex_event_authoring_flow_model');
  pushFamily(families, 'existing_event_roundtrip', 'supported', 'Starter Demo existing event applied on temp copy, re-indexed, and reopened', 'check_existing_event_roundtrip_model');
  pushFamily(families, 'option_add_existing', 'guarded', 'existing event roundtrip produced guarded insert_text', 'check_existing_event_roundtrip_model');
  pushFamily(families, 'branch_add_existing', 'advanced', 'existing event roundtrip produced advanced insert_text', 'check_existing_event_roundtrip_model');
  pushFamily(families, 'new_event_roundtrip', 'supported', 'Starter Demo complex create applied on temp copy, re-indexed, and reopened', 'check_starter_demo_complex_event_create_model');
  pushFamily(families, 'option_add_new', 'supported', 'new-event canvas added nested option before install', 'check_starter_demo_complex_event_create_model');
  pushFamily(families, 'branch_add_new', 'supported', 'new-event canvas added branch before install', 'check_starter_demo_complex_event_create_model');
  pushFamily(families, 'effect_add_new', 'supported', 'new-event install plan includes trigger/variable effect operations', 'check_starter_demo_complex_event_create_model');
  pushFamily(families, 'manual_boundary', 'manual_boundary', 'JS block effects, fuzzy routes without parser evidence, and protected/generated output stay outside quick auto-apply', 'Goal AU boundary');
  pushFamily(families, 'full_external_sweep', 'unsupported_in_quick', 'external SDAAH/Dynamic full sweep is intentionally opt-in', 'realworld-full');

  const durationMs = Date.now() - started;
  const report = {
    ok: true,
    kind: 'realworld_quick_matrix',
    durationMs,
    timedOut: false,
    mode: 'quick',
    fixture: 'starter-demo-temp-copy plus synthetic source graph/route/effect workflows',
    runs: runs.map((run) => ({
      id: run.id,
      command: run.command,
      ok: run.ok,
      durationMs: run.durationMs,
      timedOut: run.timedOut
    })),
    summaries: {
      existingEvent: existingRoundtrip ? {
        operations: existingRoundtrip.operations,
        applyStatuses: existingRoundtrip.applyStatuses,
        reindexedSceneCount: existingRoundtrip.reindexedSceneCount,
        reopenedOptions: existingRoundtrip.reopenedOptions,
        reopenedActions: existingRoundtrip.reopenedActions
      } : null,
      newEvent: newRoundtrip ? {
        sceneId: newRoundtrip.sceneId,
        operations: newRoundtrip.operations,
        sceneCount: newRoundtrip.sceneCount,
        reopenedOptions: newRoundtrip.reopenedOptions,
        reopenedActions: newRoundtrip.reopenedActions
      } : null
    },
    families,
    counts: Object.assign({
      families: families.length,
      applied: families.filter((row) => ['supported', 'guarded', 'advanced'].includes(row.status)).length,
      manualBoundaries: families.filter((row) => row.status === 'manual_boundary').length,
      refused: families.filter((row) => row.status === 'refused').length,
      unsupported: families.filter((row) => row.status === 'unsupported' || row.status === 'unsupported_in_quick').length
    }, summarizeFamilies(families))
  };

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main().catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
