#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const coverage = require('./authoring/visible_object_coverage_model.js');

function fail(message, details) {
  process.stderr.write(JSON.stringify(Object.assign({ok: false, message}, details || {}), null, 2) + '\n');
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) {
    fail(message, details);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function syntheticIndex() {
  const eventPath = 'source/scenes/events/visible_event.scene.dry';
  const cardPath = 'source/scenes/cards/visible_card.scene.dry';
  return {
    schemaVersion: '0.1',
    project: {name: 'Visible Object Coverage Fixture', root: '/tmp/visible-object-coverage'},
    scenes: [
      {
        id: 'visible_event',
        title: 'Visible Event',
        path: eventPath,
        type: 'event',
        sourceSpan: {path: eventPath, startLine: 1, endLine: 30},
        options: [{
          target: {id: 'next'},
          title: 'Continue',
          sourceSpan: {path: eventPath, line: 12, startLine: 12, endLine: 12, anchorText: '- @next: Continue', endAnchorText: '- @next: Continue'}
        }]
      },
      {
        id: 'visible_card',
        title: 'Visible Card',
        path: cardPath,
        type: 'card',
        tags: ['card'],
        flags: {isCard: true},
        sourceSpan: {path: cardPath, startLine: 1, endLine: 30},
        options: [{
          target: {id: 'root'},
          title: 'Play card',
          sourceSpan: {path: cardPath, line: 10, startLine: 10, endLine: 10, anchorText: '- @root: Play card', endAnchorText: '- @root: Play card'}
        }]
      }
    ],
    variables: [
      {name: 'public_order', reads: [{path: eventPath, line: 12}], writes: [{path: eventPath, line: 20}]}
    ],
    semantic: {
      events: [{id: 'visible_event', title: 'Visible Event', path: eventPath}],
      cards: [{id: 'visible_card', title: 'Visible Card', path: cardPath}],
      news: {
        items: [
          {
            id: 'news_visible',
            headline: 'Visible news',
            description: 'A visible news paragraph.',
            delivery: 'dated',
            source: {path: 'source/scenes/post_event_news.scene.dry', line: 10}
          }
        ],
        eventPopups: [
          {
            id: 'popup_visible',
            title: 'Popup visible',
            description: 'A popup routed through an event.',
            linkedSceneId: 'visible_event',
            delivery: 'legacy_event_popup',
            excerptSource: {path: eventPath, line: 9}
          }
        ]
      },
      textCorpus: {
        items: [
          {
            id: 'visible_event_title',
            text: 'Visible Event',
            role: 'title',
            owner: {kind: 'scene', sceneId: 'visible_event'},
            source: {path: eventPath, line: 1}
          },
          {
            id: 'visible_event_body',
            text: 'The visible event can be edited.',
            role: 'body',
            owner: {kind: 'scene', sceneId: 'visible_event', sectionId: 'start'},
            source: {path: eventPath, line: 8}
          },
          {
            id: 'visible_event_option',
            text: 'Continue',
            role: 'option_label',
            owner: {kind: 'scene', sceneId: 'visible_event', sectionId: 'start', itemId: 'next'},
            source: {path: eventPath, line: 12, anchorText: '- @next: Continue', endAnchorText: '- @next: Continue'}
          },
          {
            id: 'visible_event_effect',
            text: 'Q.public_order += 1;',
            role: 'script',
            owner: {kind: 'scene', sceneId: 'visible_event', sectionId: 'next'},
            source: {path: eventPath, line: 20, anchorText: 'Q.public_order += 1;', endAnchorText: 'Q.public_order += 1;'}
          },
          {
            id: 'visible_card_body',
            text: 'The visible card can be edited.',
            role: 'body',
            owner: {kind: 'scene', sceneId: 'visible_card', sectionId: 'start', sceneType: 'card'},
            source: {path: cardPath, line: 7}
          },
          {
            id: 'root_body',
            text: 'Root entry text belongs to System UI.',
            role: 'body',
            owner: {kind: 'scene', sceneId: 'root'},
            source: {path: 'source/scenes/root.scene.dry', line: 4}
          },
          {
            id: 'news_headline',
            text: 'Visible news',
            role: 'news_headline',
            owner: {kind: 'news', delivery: 'dated'},
            source: {path: 'source/scenes/post_event_news.scene.dry', line: 10}
          }
        ]
      },
      surfaceText: {
        items: [
          {
            id: 'sidebar_label',
            label: 'Resources',
            area: 'sidebar',
            editability: 'draft_exportable',
            source: {path: 'source/qdisplays/resources.qdisplay.dry', line: 1},
            owner: {kind: 'surface_text'}
          }
        ]
      }
    }
  };
}

const starterPath = path.join(__dirname, 'templates', 'starter-demo', 'project-index.json');
const starterReport = coverage.buildCoverageReport(readJson(starterPath));
assert(starterReport.kind === 'visible_object_coverage_report', 'starter report should expose coverage report kind');
assert(starterReport.summary.routeCoverage === 1, 'starter demo should route every visible item', starterReport.summary);
assert(starterReport.summary.visibleEditableCoverage === 1, 'starter demo visible content should be editable', starterReport.summary);
assert(starterReport.summary.visibleEditActionCoverage === 1, 'starter demo visible content should expose click-to-edit actions', starterReport.summary);
assert(starterReport.summary.visibleEditActionMissingCount === 0, 'starter demo visible rows should not miss click-to-edit actions', starterReport.summary);
assert(starterReport.summary.visibleDisplayOnlyCount === 0, 'starter demo should not expose display-only visible rows', starterReport.summary);
assert(starterReport.summary.visibleManualReviewCount === 0, 'starter demo visible rows should not fall back to manual review', starterReport.summary);
assert(starterReport.summary.visibleRefusedCount === 0, 'starter demo visible rows should not be refused', starterReport.summary);
assert(starterReport.summary.goalW.passes70, 'starter demo should pass Goal W 70% coverage', starterReport.summary.goalW);
assert(starterReport.summary.unsupportedCount === 0, 'starter demo should not have unsupported visible object rows', starterReport.summary);
assert(starterReport.summary.byRoute.object_workspace >= 1, 'starter demo should count object workspace routes', starterReport.summary.byRoute);
assert(starterReport.summary.byRoute.system_ui_workspace >= 1, 'starter demo should count System UI routes', starterReport.summary.byRoute);
assert(starterReport.summary.structuredLogicCoverage === 1, 'starter demo structured logic should be represented or routed', starterReport.summary);
assert(starterReport.summary.goalX.structuredLogicEligible >= 1, 'starter demo should include Goal X structured logic rows', starterReport.summary.goalX);

const syntheticReport = coverage.buildCoverageReport(syntheticIndex());
assert(syntheticReport.summary.routeCoverage === 1, 'synthetic report should route every visible row', syntheticReport.summary);
assert(syntheticReport.summary.visibleEditableCoverage === 1, 'synthetic report visible content should be editable', syntheticReport.summary);
assert(syntheticReport.summary.visibleEditActionCoverage === 1, 'synthetic report visible content should expose click-to-edit actions', syntheticReport.summary);
assert(syntheticReport.summary.visibleEditActionMissingCount === 0, 'synthetic report visible rows should not miss click-to-edit actions', syntheticReport.summary);
assert(syntheticReport.summary.visibleDisplayOnlyCount === 0, 'synthetic report should not expose display-only visible rows', syntheticReport.summary);
assert(syntheticReport.summary.visibleManualReviewCount === 0, 'synthetic report visible rows should not fall back to manual review', syntheticReport.summary);
assert(syntheticReport.summary.visibleRefusedCount === 0, 'synthetic report visible rows should not be refused', syntheticReport.summary);
assert(syntheticReport.summary.goalW.passes70, 'synthetic report should pass Goal W with visible edit routes', syntheticReport.summary.goalW);
assert(syntheticReport.rows.some((row) => row.area === 'news' && row.installSafety === 'advanced_apply'), 'news/router rows should be visible advanced apply routes', syntheticReport.rows);
assert(syntheticReport.rows.some((row) => row.area === 'system_ui' && row.routeClass === 'system_ui_workspace'), 'System UI text should route out of story editing', syntheticReport.rows);
assert(syntheticReport.rows.some((row) => row.area === 'variables' && row.routeClass === 'variable_workspace' && row.editable), 'variables should have an editable Goal X route', syntheticReport.rows);
assert(syntheticReport.rows.some((row) => row.view === 'structuredLogic' && row.role === 'route'), 'structured route rows should be counted for Goal X', syntheticReport.rows);
assert(syntheticReport.rows.some((row) => row.view === 'structuredLogic' && row.role === 'route' && row.safeEditable), 'source-backed route rows should be safely editable for Goal X', syntheticReport.rows);
assert(syntheticReport.rows.some((row) => row.view === 'structuredLogic' && row.role === 'effect' && row.safeEditable), 'simple Q effect rows should be safely editable for Goal X', syntheticReport.rows);

process.stdout.write(JSON.stringify({
  ok: true,
  starter: {
    rows: starterReport.summary.total,
    routeCoverage: starterReport.summary.routeCoverage,
    visibleEditableCoverage: starterReport.summary.visibleEditableCoverage,
    visibleEditActionCoverage: starterReport.summary.visibleEditActionCoverage,
    goalW: starterReport.summary.goalW.safeEditCoverage,
    goalX: starterReport.summary.goalX.safeEditCoverage
  },
  synthetic: {
    rows: syntheticReport.summary.total,
    visibleEditableCoverage: syntheticReport.summary.visibleEditableCoverage,
    visibleEditActionCoverage: syntheticReport.summary.visibleEditActionCoverage,
    visibleDisplayOnlyCount: syntheticReport.summary.visibleDisplayOnlyCount,
    manualBoundaries: syntheticReport.summary.manualBoundaryCount,
    unsupported: syntheticReport.summary.unsupportedCount
  }
}, null, 2) + '\n');
