#!/usr/bin/env node
'use strict';

const coverage = require('./authoring/visible_object_coverage_model.js');
const installPlan = require('./authoring/install_plan.js');

const {failJson: fail, assertJson: assert} = require('./check_harness.js');

function fixtureIndex() {
  const eventPath = 'source/scenes/events/visible_event.scene.dry';
  const cardPath = 'source/scenes/cards/visible_card.scene.dry';
  const routerPath = 'source/scenes/post_event_news.scene.dry';
  const rootPath = 'source/scenes/root.scene.dry';
  return {
    schemaVersion: '0.1',
    project: {name: 'Visible Means Editable Fixture', root: '/tmp/visible-means-editable'},
    scenes: [
      {
        id: 'visible_event',
        title: 'Visible Event',
        path: eventPath,
        type: 'event',
        sourceSpan: {path: eventPath, startLine: 1, endLine: 40},
        options: [
          {
            target: {id: 'next'},
            title: 'Continue',
            sourceSpan: {path: eventPath, line: 12, startLine: 12, endLine: 12, anchorText: '- @next: Continue', endAnchorText: '- @next: Continue'}
          }
        ]
      },
      {
        id: 'visible_card',
        title: 'Visible Card',
        path: cardPath,
        type: 'card',
        tags: ['card'],
        flags: {isCard: true},
        sourceSpan: {path: cardPath, startLine: 1, endLine: 30},
        options: [
          {
            target: {id: 'visible_event'},
            title: 'Play card',
            sourceSpan: {path: cardPath, line: 10, startLine: 10, endLine: 10, anchorText: '- @visible_event: Play card', endAnchorText: '- @visible_event: Play card'}
          }
        ]
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
            id: 'router_headline',
            headline: 'Router Headline',
            delivery: 'dated',
            source: {path: routerPath, line: 8, anchorText: '- @visible_event: Router Headline', endAnchorText: '- @visible_event: Router Headline'}
          }
        ],
        eventPopups: [
          {
            id: 'monthly_popup',
            title: 'Monthly Popup',
            linkedSceneId: 'visible_event',
            delivery: 'legacy_event_popup',
            excerptSource: {path: eventPath, line: 9, anchorText: 'Monthly popup body.', endAnchorText: 'Monthly popup body.'}
          }
        ]
      },
      textCorpus: {
        items: [
          {
            id: 'event_body',
            text: 'Visible event body.',
            role: 'body',
            owner: {kind: 'scene', sceneId: 'visible_event', sectionId: 'start'},
            source: {path: eventPath, line: 8, anchorText: 'Visible event body.', endAnchorText: 'Visible event body.'}
          },
          {
            id: 'card_body',
            text: 'Visible card body.',
            role: 'body',
            owner: {kind: 'scene', sceneId: 'visible_card', sectionId: 'start', sceneType: 'card'},
            source: {path: cardPath, line: 7, anchorText: 'Visible card body.', endAnchorText: 'Visible card body.'}
          },
          {
            id: 'conditional_route',
            text: 'Continue',
            role: 'option_label',
            owner: {kind: 'scene', sceneId: 'visible_event', sectionId: 'start', itemId: 'next'},
            source: {path: eventPath, line: 12, anchorText: '- @next: Continue', endAnchorText: '- @next: Continue'}
          },
          {
            id: 'shared_effect',
            text: 'Q.public_order += 1; Q.momentum += 1;',
            role: 'script',
            owner: {kind: 'scene', sceneId: 'visible_event', sectionId: 'next'},
            source: {path: eventPath, line: 20, anchorText: 'Q.public_order += 1; Q.momentum += 1;', endAnchorText: 'Q.public_order += 1; Q.momentum += 1;'}
          },
          {
            id: 'router_visible_text',
            text: 'Router Headline',
            role: 'news_headline',
            owner: {kind: 'news', delivery: 'dated'},
            source: {path: routerPath, line: 8, anchorText: '- @visible_event: Router Headline', endAnchorText: '- @visible_event: Router Headline'}
          },
          {
            id: 'root_visible_text',
            text: 'Start the mod',
            role: 'body',
            owner: {kind: 'scene', sceneId: 'root'},
            source: {path: rootPath, line: 4, anchorText: 'Start the mod', endAnchorText: 'Start the mod'}
          },
          {
            id: 'generated_label',
            text: 'Generated visible label',
            role: 'surface_label',
            owner: {kind: 'surface_text'},
            source: {path: 'out/html/index.html', line: 22, anchorText: 'Generated visible label', endAnchorText: 'Generated visible label'}
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
            source: {path: 'source/qdisplays/resources.qdisplay.dry', line: 1, anchorText: 'Resources', endAnchorText: 'Resources'},
            owner: {kind: 'surface_text'}
          }
        ]
      }
    }
  };
}

function assertAdvancedOperation(operation, message) {
  const classification = installPlan.classifyOperation(operation);
  assert(classification.status === 'advanced_apply', message, {classification, operation});
}

const report = coverage.buildCoverageReport(fixtureIndex());
const visibleRows = report.rows.filter((row) => row.visibleContent);
const displayOnlyRows = visibleRows.filter((row) => row.visibleDisplayOnly);
const manualRows = visibleRows.filter((row) => row.installSafety === 'manual_review' || row.routeClass === 'manual_review');
const refusedRows = visibleRows.filter((row) => row.installSafety === 'refused');
const snippetRows = visibleRows.filter((row) => row.installOperationType === 'manual_snippet');

assert(report.summary.visibleEditableCoverage === 1, 'visibleEditableCoverage must be 1.0', report.summary);
assert(report.summary.visibleEditActionCoverage === 1, 'visible rows must expose click-to-edit actions', report.summary);
assert(report.summary.visibleEditActionMissingCount === 0, 'visible rows must not miss click-to-edit actions', report.summary);
assert(report.summary.visibleEditActionUnresolvedCount === 0, 'visible click-to-edit actions must resolve', report.summary);
assert(report.summary.visibleDisplayOnlyCount === 0, 'visibleDisplayOnlyCount must be 0', {displayOnlyRows});
assert(report.summary.visibleUnsupportedCount === 0, 'unsupported visible content must be 0', report.summary);
assert(manualRows.length === 0, 'visible content must not fall back to manual_review', {manualRows});
assert(refusedRows.length === 0, 'visible content must not be refused', {refusedRows});
assert(snippetRows.length === 0, 'visible content must not produce manual_snippet-only operations', {snippetRows});

assert(visibleRows.some((row) => row.role === 'monthly_popup' && row.editable && row.routeClass === 'object_workspace'), 'monthly popup linked content should be editable through the event object workspace', visibleRows);
assert(visibleRows.some((row) => row.role === 'route' && row.editable && row.installOperationType), 'conditional route rows should generate source-backed edit operations', visibleRows);
assert(visibleRows.some((row) => row.role === 'effect' && row.editable && row.installOperationType), 'effect rows should generate source-backed edit operations', visibleRows);
assert(visibleRows.some((row) => row.objectType === 'variable' && row.editable && row.installSafety === 'advanced_apply'), 'existing variables should be editable with impact preview and advanced apply', visibleRows);
assert(visibleRows.some((row) => row.source.path === 'source/scenes/root.scene.dry' && row.installSafety === 'guarded_apply'), 'root source-backed visible rows with exact evidence should be guarded_apply', visibleRows);
assert(visibleRows.some((row) => row.source.path === 'out/html/index.html' && row.routeClass === 'advanced_source_patch' && row.installSafety === 'advanced_apply'), 'generated visible evidence should be mapped to an advanced source route instead of refused', visibleRows);

assertAdvancedOperation({
  type: 'replace_text',
  path: 'source/scenes/post_event_news.scene.dry',
  line: 8,
  search: '- @visible_event: Router Headline',
  replace: '- @visible_event: Updated Router Headline',
  safety: 'advanced_apply',
  description: 'Advanced router line replacement.'
}, 'advanced_source_patch replace_text should be installable for protected router source');

assertAdvancedOperation({
  type: 'replace_section',
  path: 'source/scenes/root.scene.dry',
  anchorText: '= Start',
  endAnchorText: '- @visible_event: Start',
  content: '= Start\nStart the edited mod.\n- @visible_event: Start',
  dedupeSearch: 'Start the edited mod.',
  safety: 'advanced_apply',
  description: 'Advanced root source slice replacement.'
}, 'advanced_source_patch replace_section should be installable for protected root source');

process.stdout.write(JSON.stringify({
  ok: true,
  visibleRows: visibleRows.length,
  visibleEditableCoverage: report.summary.visibleEditableCoverage,
  visibleEditActionCoverage: report.summary.visibleEditActionCoverage,
  visibleDisplayOnlyCount: report.summary.visibleDisplayOnlyCount,
  byRoute: report.summary.byRoute,
  bySafety: report.summary.bySafety
}, null, 2) + '\n');
