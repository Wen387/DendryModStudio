# Dendry Mod Studio Contributor Workflow

This file describes the local development checks and boundaries for the Studio
code in this repository.

## Current Shape

- `tools/project_map/build_project_map.py` builds a ProjectIndex from a Dendry project.
- `tools/project_map/viewer/` is the browser Studio UI.
- `tools/project_map/desktop/` is the Electron shell and desktop packaging setup.
- `tools/project_map/authoring/` contains proposal, preview, install-plan, and meaning-layer models.
- `tools/project_map/templates/starter-demo/` is the bundled demo project for first-time users.

## Core And Non-Core Map

- Core product code: `build_project_map.py`, `parse_dry_project.js`,
  `indexer/`, `authoring/`, `viewer/`, and `desktop/` runtime/apply paths.
  These shape what users can inspect, edit, preview, or apply.
- Guardrail checks: `check_*.js`, smoke/doctor scripts, and CI config. Treat
  them as alarms and contracts, not feature homes.
- Templates, schema, and docs: public templates, schema files, release notes,
  and workflow docs. Use them to preserve examples and expectations.
- Generated and ignored noise: `out/`, `dist/`, `dist-builder/`,
  `node_modules/`, logs, package artifacts, local fixture checkouts, and copied
  game projects. Do not read architectural intent from them or make them part of
  product changes.

High-risk core areas are large browser entry files, canvas/inspector controls,
Review & Apply/runtime preview code, parser/indexer/router handling, install
classification, and desktop filesystem/apply bridges. Before editing them, find
the smallest owner module, prefer nearby model/helper splits over growing a
large entry file, and run the related checks in `package.json` and this workflow.

## Maintainer Flow Map

Use this path when orienting on current authoring work:

1. Indexer/parser:
   `build_project_map.py`, `parse_dry_project.js`, and `indexer/` build
   ProjectIndex rows plus semantic evidence for text, routes, effects,
   variables, runtime surfaces, and profile/router anchors.
2. Authoring models:
   `authoring/` converts that evidence into visible edit actions, semantic
   logic editors, source-slice fallback proposals, Complex Event Builder drafts,
   and install-plan operations.
3. Renderer/entry surfaces:
   `viewer/` renders Explore, Event Workbench, Card Board, Object Canvas,
   Complex Event Builder, Source Slice, Semantic Logic, and Review & Apply.
   If a feature has a model, it should have a rendered workflow entry.
4. Review & Apply:
   browser mode previews plans only; desktop mode can dry-run/apply safe,
   guarded, or explicitly advanced operations.
5. Desktop/runtime evidence:
   `desktop/` owns native folder access, runtime preview copies, focused Runtime
   Lens sessions, and verified dry-run/apply evidence.

## Safe Boundaries

- Browser mode is review-only.
- Desktop mode can dry-run/apply only install-plan operations classified as safe, guarded, or explicitly advanced.
- Manual-review and refused operations are not applied.
- Runtime Preview builds temporary baseline/modified copies and does not patch the real project folder.
- Generated runtime output such as `out/html`, `out/game.json`, and `.git` is protected from automatic edits.

## Pre-Push Checks

Install root dependencies once:

```bash
npm ci --ignore-scripts
```

```bash
npm run check:ci
```

For large Studio feature work or refactors, also run the advisory source-size
report before and after the change:

```bash
node tools/project_map/check_source_complexity.js
```

The default report is intentionally advisory and exits 0. It highlights files
that are becoming harder to maintain and points to likely split points.

For governance sweeps and PR review, optionally enforce the current complexity
budget:

```bash
npm run check:complexity
```

Budget enforcement reads `tools/project_map/source_complexity_budget.json` and
fails only when a new exception-sized file appears or a baseline exception grows
past its `maxLines`. Warn-level files remain advisory unless they cross into
exception size. This check is not currently wired into `check:ci`.

Desktop checks after `npm ci` in `tools/project_map/desktop`:

```bash
npm run doctor
npm run smoke
```
