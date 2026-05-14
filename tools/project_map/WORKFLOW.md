# Dendry Mod Studio Contributor Workflow

This file describes the local development checks and boundaries for the Studio
code in this repository.

## Current Shape

- `tools/project_map/build_project_map.py` builds a ProjectIndex from a Dendry project.
- `tools/project_map/viewer/` is the browser Studio UI.
- `tools/project_map/desktop/` is the Electron shell and desktop packaging setup.
- `tools/project_map/authoring/` contains proposal, preview, install-plan, and meaning-layer models.
- `tools/project_map/templates/starter-demo/` is the bundled demo project for first-time users.
- `studio_contract/` is the IslandSunrise compatibility contract fixture used to keep Studio parsing stable.

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
node tools/project_map/check_llm_friendliness.js
```

The report is intentionally advisory. It highlights files that are becoming
hard for LLM-assisted edits and points to likely split seams.

Desktop checks after `npm ci` in `tools/project_map/desktop`:

```bash
npm run doctor
npm run smoke
```
