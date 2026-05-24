#!/usr/bin/env node
'use strict';

const confidence = require('./authoring/parser_renderer_confidence_model.js');

const {failJson: fail, assertJson: assert} = require('./check_harness.js');

const index = {
  diagnostics: [
    {
      severity: 'info',
      code: 'project_map.conditional_goto',
      sceneId: 'branching_event',
      path: 'source/scenes/events/branching_event.scene.dry',
      source: {path: 'source/scenes/events/branching_event.scene.dry', line: 20},
      message: 'Conditional or chained goTo requires runtime ordering awareness: next if flag; fallback'
    },
    {
      severity: 'info',
      code: 'project_map.dynamic_q_opaque',
      path: 'source/scenes/events/branching_event.scene.dry',
      source: {path: 'source/scenes/events/branching_event.scene.dry', line: 30},
      expression: '"news_" + cycle',
      classification: 'dynamic_concatenation',
      safeExpansion: false,
      message: 'Dynamic Q[] key could not be statically expanded: Q["news_" + cycle]'
    },
    {
      severity: 'error',
      code: 'runtime_surface.missing_script',
      message: 'Missing out/html/core.js',
      missingPath: 'out/html/core.js'
    },
    {
      severity: 'warning',
      code: 'runtime_surface.partial_runtime',
      message: 'Generated runtime is partial.'
    }
  ],
  semantic: {
    news: {
      eventPopups: [
        {
          id: 'monthly_1930',
          title: '1930',
          linkedSceneId: 'monthly_1930',
          delivery: 'legacy_event_popup',
          excerptSource: {path: 'source/scenes/events/monthly_1930.scene.dry', line: 8}
        }
      ]
    },
    textCorpus: {
      items: [
        {
          id: 'effect_public_order',
          text: 'Q.public_order += 1;',
          role: 'script',
          source: {
            path: 'source/scenes/events/branching_event.scene.dry',
            line: 40,
            anchorText: 'Q.public_order += 1; Q.stability -= 1;'
          }
        },
        {
          id: 'effect_stability',
          text: 'Q.stability -= 1;',
          role: 'script',
          source: {
            path: 'source/scenes/events/branching_event.scene.dry',
            line: 40,
            anchorText: 'Q.public_order += 1; Q.stability -= 1;'
          }
        }
      ]
    },
    runtimeSurface: {
      readiness: {status: 'partial', quickPreviewReady: false, missingDependencyCount: 1},
      diagnostics: []
    }
  }
};

const report = confidence.buildConfidenceReport(index, {sampleLimit: 4});
assert(report.kind === 'parser_renderer_confidence_report', 'report should expose its model kind', report);
assert(report.routeOrder.count === 1, 'report should count conditional route-order diagnostics', report.routeOrder);
assert(report.routeOrder.installSafety === 'manual_review', 'route-order evidence should stay manual review', report.routeOrder);
assert(report.dynamicQ.count === 1, 'report should count opaque dynamic Q diagnostics', report.dynamicQ);
assert(report.dynamicQ.classifications.dynamic_concatenation === 1, 'dynamic Q report should preserve parser classification', report.dynamicQ);
assert(report.dynamicQ.safeExpansionCount === 0, 'dynamic Q report should not claim unsafe static expansion', report.dynamicQ);
assert(report.monthlyPopups.count === 1, 'report should count monthly popups', report.monthlyPopups);
assert(report.monthlyPopups.contentRoute === 'object_workspace', 'monthly popup content should route through object workspace evidence', report.monthlyPopups);
assert(report.monthlyPopups.routerBoundary === 'manual_review', 'monthly popup router boundary should stay manual review', report.monthlyPopups);
assert(report.sharedEffects.lineCount === 1, 'report should find co-located source-line effects', report.sharedEffects);
assert(report.sharedEffects.installSafety === 'manual_review', 'shared effects should stay manual review', report.sharedEffects);
assert(report.runtimeReadiness.fallbackRequired, 'incomplete generated runtime should require fallback evidence', report.runtimeReadiness);
assert(report.runtimeReadiness.fallbackMode === 'temporary_full_build', 'runtime fallback mode should name the temporary full build', report.runtimeReadiness);
assert(report.summary.runtimeFallbackRequired === true, 'summary should preserve runtime fallback state', report.summary);

process.stdout.write(JSON.stringify({
  ok: true,
  routeOrder: report.routeOrder.count,
  dynamicQ: report.dynamicQ.classifications,
  monthlyPopups: report.monthlyPopups.count,
  sharedEffectLines: report.sharedEffects.lineCount,
  runtimeFallback: report.runtimeReadiness.fallbackMode
}, null, 2) + '\n');
