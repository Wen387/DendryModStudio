# Dendry Project Map

Dendry Mod Studio tooling for inspecting, editing, previewing, and safely
installing Dendry/DendryNexus project changes.

For development workflow, smoke tiers, packaging hygiene, and contributor
boundaries, see `tools/project_map/WORKFLOW.md`.

## Repository Layout

This directory contains the shared Project Map scanner, browser viewer, desktop
shell, authoring helpers, templates, compatibility fixtures, and repeatable QA
checks used by Dendry Mod Studio.

Current maintainer map:

- Indexing produces a ProjectIndex plus parser-backed semantic evidence for
  visible text, routes, effects, variables, runtime surfaces, and protected
  router boundaries.
- Rendering surfaces consume structured edit actions rather than diagnostic
  strings. Explore, Event Workbench, Card Board, Object Canvas, and Complex
  Event Builder all route visible content through the same click-to-edit
  contract.
- Object Editing Modal owns detailed edits. Storyboard, Card Board, Design, and
  Runtime Lens are context/navigation surfaces.
- Browser mode is review-only. Desktop mode can dry-run or apply install-plan
  operations classified as `safe_apply`, `guarded_apply`, or explicitly
  confirmed `advanced_apply`.
- Source Slice and Advanced Source Patch are fallback editors for source-backed
  visible content. They still generate install operations; they are not manual
  copy/paste flows.
- Generated runtime output, `.git`, and protected build artifacts remain
  protected. Edits must map back to source-backed operations.

## One-command local launch

For normal local use, start here:

```bash
python3 tools/project_map/launch_studio.py
```

The launcher:

- generates `/tmp/dendry_project_map/project-index.json`;
- starts a local static viewer server;
- auto-selects another port if `8765` is busy;
- opens a URL that auto-loads the generated index;
- keeps browser mode review-only; source writes require desktop Review & Apply
  or the guarded CLI apply path.

For review indexes with source excerpts:

```bash
python3 tools/project_map/launch_studio.py --include-excerpts
```

If browser auto-open is annoying on your machine:

```bash
python3 tools/project_map/launch_studio.py --no-open
```

To inspect what it would do without generating an index or starting a server:

```bash
python3 tools/project_map/launch_studio.py --dry-run --no-open
```

## Desktop App

v0.5 adds an isolated Electron desktop shell under `tools/project_map/desktop/`;
v0.5.1 adds first-run diagnostics; v0.5.2 adds a portable package;
v0.5.3 adds a local Linux `.deb` package;
v0.5.4 hardens that `.deb` with runtime dependencies, an app icon, and default
cleanup of temporary packaging work directories; v0.5.5 adopts the Studio UI
surface in the shared viewer; v0.6 adds the News Wizard and advisor-like naming
foundation; v0.65 adds Card / Advisor-like authoring and Surface Text proposals.
v0.66 adds install-plan / patch-preview bundles plus a guarded CLI apply path
for safe operations; v0.66.1 adds operation checklist previews and human CLI
breakdowns; v0.67 adds Explore -> Edit as Draft for existing indexed content,
an Install mode, Coverage Map, and card wiring proposals; v0.7 adds the
Direction C graph-first Design tab with optional baseline compare.
The desktop package version is now `0.97` to match the current dev preview
surface. This is still preparation for the future beginner-facing app, not a
signed public installer yet. The root game package stays untouched.

First install the shell dependencies:

```bash
cd tools/project_map/desktop
npm ci
```

Then start the desktop window:

```bash
npm run start
```

To check the local desktop environment without opening the Electron window:

```bash
npm run doctor
```

The desktop shell:

- opens the existing Project Map viewer in a standalone Electron window;
- uses a native `Open Project Folder` picker;
- validates that the folder contains `source/info.dry`;
- offers a `Check Setup` preflight for app files, the bundled Python runtime,
  scratch storage, and project-folder readiness;
- runs the indexer into Electron's userData scratch directory;
- sends the generated `ProjectIndex` to the viewer through a preload IPC bridge;
- checks the configured announcement manifest and shows an announcement preview
  plus a manual download / release-notes banner when needed;
- opens Complex Event Builder, visible click-to-edit, source-slice fallback,
  asset-copy proposals, profile-aware router registration, and Review & Apply
  from the same Studio UI;
- in desktop mode, can dry-run or apply install-plan operations classified as
  safe, guarded, or explicitly advanced.
- in desktop mode, can create a Runtime Preview sandbox: baseline and modified
  temporary copies are built separately, the install plan is applied only to the
  modified copy, and a `127.0.0.1` compare page shows original versus modified.

Current v0.97 limits:

- release builds include the Python runtime used by the desktop indexer;
- public release installers are unsigned and still need clean-machine QA,
  backup guidance, signing, and full release-channel hardening;
- announcements and update notices are static manifest polling only. The
  default manifest URL is configured in `desktop/package.json` and can be
  overridden with `DMS_UPDATE_MANIFEST_URL`; `DMS_UPDATE_NOTICE_DISABLED=1`
  disables the check. This is not an auto-updater or silent install channel.
- `npm run dist:linux` creates unsigned AppImage and Deb artifacts under
  ignored `dist-builder/`;
- `npm run dist:win` creates an unsigned Windows NSIS installer under
  `dist-builder/` when run on Windows or GitHub Actions;
- the older `package:dir`, `package:portable`, and `package:deb` helpers remain
  useful for local packaging diagnostics under ignored `dist/`;
- the shell never writes generated output such as `out/game.json` or `out/html`;
  source edits happen only through reviewed install-plan operations.
- authoring bundles include install plans, patch previews, and player-facing
  operation labels; router / wiring work becomes installable when the active
  profile provides explicit anchor and dedupe evidence.
- known news/monthly popup/router profiles can produce guarded or advanced
  router registration operations. Unknown profiles show pending router-rule
  entry points instead of pretending wiring succeeded.
- card and event creation can produce scene-file, variable-init, asset-copy, and
  profile-router operations when source evidence is available.
- source-backed visible text, route, effect, variable, and surface-label edits
  route through visible edit actions. `out/html` evidence remains protected and
  must map back to source before it can be installed.
- Edit actions open existing object fields, semantic logic editors, variable
  workspaces, or source-slice fallback editors. They do not overwrite source
  until Review & Apply creates and applies an install plan.
- Install mode can review any Studio install-plan JSON. Browser mode is review
  only; desktop mode can dry-run/apply safe operations through the same guard as
  the CLI. New Studio-generated install plans record project provenance, and
  desktop/CLI apply blocks when the plan root does not match the currently
  opened project root.
- Runtime Preview uses `tools/project_map/desktop/runtime_preview.js` and
  `check_runtime_preview_sandbox_model.js`. The Debug Console surface is covered
  by `check_runtime_preview_debug_model.js` and
  `check_runtime_preview_debug_bridge.js`. It copies the opened project to a
  temporary sessions directory, applies the plan only in the modified copy, runs
  the supported build command inside each copy, and serves the comparison page on
  localhost. The console only sends structured commands for ProjectIndex-known
  variables/scenes to the modified iframe and records command summaries without
  raw variable values. It is a sandboxed preview aid, not a full WYSIWYG/runtime
  debugger and not evidence that public release QA is complete.
- Design mode is graph-first and compares ProjectIndex rows by stable keys plus
  optional source fingerprints. Missing fingerprints or low-confidence evidence
  are marked unknown, not changed.
- Coverage Map is the current coverage truth surface: visible content should
  have an edit action and installable path; non-visible internal wiring can
  remain manual or refused. Assets view has gallery cards, inspector image/audio
  preview, usage refs, reference helpers, missing-file repair proposals, and
  PreviewModel `assetRefs` display.
  PreviewModel marks assetRefs missing from the ProjectIndex asset list before
  review. Desktop `copy_asset_file` can guarded-copy a local file only when the
  plan has a sourcePath and passes hash/conflict checks; browser/no-sourcePath
  requests remain manual review. Studio still does not optimize, convert, or crop
  asset files. Preview readiness is exposed by
  `ProjectMapPreviewModel` as `ready_to_review`, `needs_review`, or
  `manual_review`; it is an authoring confidence signal, not runtime proof.
- v0.97 keeps the faster Windows installer layout from the previous preview and
  carries the newer authoring surface: Object Canvas / Story Palette draft paths,
  safer existing-content proposals, Runtime Preview evidence, Runtime Lens
  wiring, and stronger governance checks. The authoring model remains heuristic:
  unusual source layouts, opaque JS, and structural edits without reliable
  source spans must stay manual review.
- First-run Quick Start can load the bundled Starter Demo template. Desktop
  copies `tools/project_map/templates/starter-demo/` into Electron app data
  before scanning it, so the demo is a writable teaching project rather than
  a read-only package resource.

Desktop smoke checks:

```bash
cd tools/project_map/desktop
npm run smoke
npm run doctor
node ../check_update_notice_model.js
node ../check_starter_demo_model.js
npm run dist:linux
```

Guided UI QA:

```bash
node tools/project_map/check_player_like_qa_model.js
node tools/project_map/qa/run_desktop_scenario.js --scenario first_time_user
node tools/project_map/qa/run_desktop_scenario.js --scenario explore_design_existing_edit
node tools/project_map/qa/run_desktop_scenario.js --scenario draft_persistence_restart
node tools/project_map/qa/run_desktop_scenario.js --scenario load_bundled_demo_template
```

These scenarios launch the real Studio viewer in Electron. They cover Quick
Start, Tutorial Library, Open Project through the test dialog adapter, Create, My
Changes, Review & Apply, desktop dry-run, wrong-project refusal, and the
Explore -> Design -> Edit existing guarded replacement path. They also cover a
returning-author path where a saved draft survives a Studio renderer reload,
reopens from My Changes, and dry-runs from the persisted install plan. They also
cover the bundled Demo Template path from Quick Start into a writable starter
project. They write screenshots and a `QA_LEDGER.md` under `/tmp/dendry_mod_studio_qa/`. See
`tools/project_map/qa/README.md`.

See `tools/project_map/desktop/PACKAGING_NOTES.md` for the v0.97 packaging
boundary and `tools/project_map/RELEASE_NOTES_v0.97.md` for the tester-facing
dev preview notes and known limits. Do not commit `tools/project_map/desktop/dist/`
or `node_modules/`. Before any public release claim, run `npm run check:ci`,
attach the release notes, and record the exact package artifact tested.

## Build an index

```bash
python3 tools/project_map/build_project_map.py --root . --out /tmp/dendry_project_map/project-index.json --summary
```

For review sessions, include short source excerpts:

```bash
python3 tools/project_map/build_project_map.py --root . --out /tmp/dendry_project_map/project-index-excerpts.json --summary --include-excerpts
```

`--include-excerpts` is opt-in. It adds small line-numbered snippets to source
refs for inspection, while keeping the default index compact. Use
`--excerpt-context-lines N` to adjust the context window; the default is `1`
and the maximum is `5`.

The indexer is read-only. It does not write source files, does not use
`out/game.json` as a data source, and does not touch `out/html`. It refuses to
write Project Map output under `out/html`.

`source/scenes/post_event.scene.dry` is intentionally opaque. The parser wrapper
does not full-parse it; the Python layer adds a synthetic monthly-router scene
and only a bounded targeted routing summary.

## Open the viewer

Open this file in a browser:

```text
tools/project_map/viewer/index.html
```

Then choose:

```text
/tmp/dendry_project_map/project-index.json
```

Or, for source excerpts:

```text
/tmp/dendry_project_map/project-index-excerpts.json
```

The viewer uses the browser File API when opened directly, so it can run from a
local file without a dev server. When opened through `launch_studio.py`, it also
supports `?index=/project-index.json` autoload from the local launcher server.
Explore mode shows Overview, Scenes, Events, Cards, News, Variables,
Surface Text, and Diagnostics. Selecting a row opens an inspector with source
spans, confidence, 1-hop edges, grouped diagnostics, surface-text editability,
and related variable refs. Scene edge endpoints are clickable in the inspector.
Project profiles can override advisor-like labels: generic Dendry and
SDAAH-style projects show Advisors; Island's Sunrise shows Circles.
Coverage Map summarizes visible editability, rendered workflow entries, install
safety, and remaining non-visible manual boundaries. Events, Cards, News,
Surface Text, variables, routes, effects, and source-backed runtime labels route
through click-to-edit actions when Studio can map them to source.

Design mode shows the same project through a Direction C / Atelier graph canvas.
Timeline Events, Cards / Advisor-like, News, Surface Text / Sidebar, and Manual
Review / Escape Hatch are filterable node categories rather than the main
layout. It can load a second ProjectIndex as an original/baseline index. Nodes
are marked `same`, `changed`, `added`, `missing from current`, `unknown`, or
`no baseline`; `changed` only appears when both sides have strong source
fingerprints. Design Inspector actions reuse `Edit as Draft` and `Open in
Explore`; no source file is installed from Design mode.

Create mode uses Complex Event Builder as the main world-event authoring flow.
It can start from a blank event, edit 2-4 root options, branch/follow-up
sections, conditions, route targets, effects, variable initialization, and asset
install requests, then block Review & Apply until readiness checks pass. The
older News, Card, Variable, Surface Text, and System UI templates remain
available, but installability now flows through the shared install-plan and
Review & Apply path instead of export-only success.

Manual walkthrough:

1. Open `tools/project_map/viewer/index.html`.
2. Select `/tmp/dendry_project_map/project-index-excerpts.json`.
3. Confirm Overview renders, source badges open excerpts, diagnostics groups
   show examples, and scene incoming/outgoing endpoints navigate the inspector.
4. Switch to Create, fill the Complex Event Builder, adjust the choice count, and
   confirm diagnostics, previews, and download buttons update.
5. Use `Load draft JSON` with a file such as
   `tools/project_map/fixtures/event_drafts/four_choice_world_event.json`; confirm
   the form updates and `Save draft JSON` preserves the draft as v0.1 JSON.
6. Use `Load draft JSON` with
   `tools/project_map/fixtures/event_drafts/advanced_world_event.json`; confirm
   Advanced panels open and previews show trigger effects, choose-if, variants,
   and custom continuation anchors.
7. Switch the Create template to News, load
   `tools/project_map/fixtures/news_drafts/sample_dated_news.json`, then repeat
   with `sample_background_news.json`; confirm snippet, draft JSON, install
   notes, diagnostics, and download buttons update.
8. Switch to Card, load
   `tools/project_map/fixtures/card_drafts/sample_action_card.json`, then
   `sample_advisor_card.json`; confirm action-card / advisor-like previews and
   install notes update.
9. Switch to Surface Text, load
   `tools/project_map/fixtures/surface_text_drafts/sample_label_replacement.json`
   and `unsupported_html_label.json`; confirm source-backed proposals and
   protected generated-output notes are distinct.
10. Open the Patch preview tab in any Create template; confirm it shows the
    generated install-plan proposal before downloading.
11. Return to Explore, select an Event, Card, News item, or Surface Text row,
    click `Edit as Draft`, and confirm Create mode opens with the matching
    draft template loaded.
12. Open Coverage Map and confirm visible rows have edit actions while
    non-visible/internal manual boundaries remain explicit.
13. Switch to Design, confirm the dark Direction C graph canvas renders, select
    an Event / Card / News / Surface Text node, and confirm `Edit as Draft`
    opens Create.
14. Load a baseline ProjectIndex in Design and confirm low-confidence or
    fingerprint-less matches are marked unknown rather than changed.
15. Open Install, load a generated `*.install-plan.json`, review the operation
    checklist, and in desktop mode run dry-run before applying safe operations.

## Review & Apply / Install Plans

Every authoring bundle or visible edit proposal can include:

- `<id>.install-plan.json`
- `<id>.patch-preview.diff`
- `<id>.install-notes.txt`

Studio Review & Apply shows operation names, safety classes, plan preview, and
verified desktop diff evidence when available. In the desktop shell it can
dry-run or apply `safe_apply`, `guarded_apply`, and explicitly confirmed
`advanced_apply` operations; in the raw browser viewer it remains a review
surface.

The install plan separates installable operations from `manual_review` and
`refused` operations. Current installable operations include:

- `create_file` for new Event / Card scene proposals.
- `replace_text` and `replace_section` for source-backed visible content,
  source slices, routes, effects, variables, and surface labels when guards
  still match.
- `copy_asset_file` for selected desktop asset sources with a project-relative
  target and conflict/hash evidence.
- profile-aware router registration when the active profile provides a
  supported anchor.

Manual-review operations stay manual and are not a success path for visible
content. They are retained for deletes, broad structural rewrites, sourceless
diagnostics, truly ambiguous profile wiring, and generated/custom internals.

Dry-run an install plan:

```bash
node tools/project_map/apply_install_plan.js \
  --plan /tmp/dendry_surface_export/<id>.install-plan.json \
  --root . \
  --summary
```

Apply reviewed safe and guarded operations after reviewing the preview:

```bash
node tools/project_map/apply_install_plan.js \
  --plan /tmp/dendry_surface_export/<id>.install-plan.json \
  --root . \
  --apply \
  --summary
```

The CLI refuses paths outside the project root, `.git`, `out/game.json`, and
`out/html/`. It never applies `manual_review` or `refused` operations.

Without `--summary`, the CLI prints a compact human breakdown:

```text
ok: true
mode: dry-run
safe apply: 1
manual review: 0
protected / refused: 0
operations: 1
diagnostics: 0
```

## Export a world event bundle

The browser wizard and CLI share `tools/project_map/authoring/event_draft.js`.
The CLI writes only an export bundle and refuses output inside the loaded project
repo; use `/tmp` for local exports.

```bash
node tools/project_map/generate_event.js \
  --draft tools/project_map/fixtures/event_drafts/sample_world_event.json \
  --index /tmp/dendry_project_map/project-index.json \
  --out-dir /tmp/dendry_event_export \
  --summary
```

The bundle contains:

- `<id>.scene.dry`
- `<id>.event-draft.json`
- `<id>.root-init.snippet.dry`
- `<id>.post-event-migration.snippet.js`
- `<id>.install-notes.txt`

The install notes list bundle files, the suggested source path, and any
non-installable router/root follow-up that still needs profile evidence before
it can become a guarded or advanced operation.

## Export a news bundle

The browser News Wizard and CLI share
`tools/project_map/authoring/news_draft.js`. The CLI writes only an export
bundle and refuses output inside the loaded project repo; use `/tmp` for local
exports.

```bash
node tools/project_map/generate_news.js \
  --draft tools/project_map/fixtures/news_drafts/sample_dated_news.json \
  --index /tmp/dendry_project_map/project-index.json \
  --out-dir /tmp/dendry_news_export \
  --summary
```

The bundle contains:

- `<id>.post-event-news.snippet.js`
- `<id>.news-draft.json`
- `<id>.install-notes.txt`

`dated` news generates `Q.news_1/2/3` and optional
`Q.news_1_desc/2_desc/3_desc` assignments. `background_pool` news generates a
`social_pool` / `intl_pool` / `gossip_pool` `.push({n, d})` snippet. When the
loaded ProjectIndex shows `source/scenes/post_event_news.scene.dry`, the install
plan uses a guarded `insert_text` with a known anchor and `// NewsDraft: <id>`
dedupe token; otherwise it reports pending profile/router evidence.

## Export a card bundle

The browser Card Wizard and CLI share
`tools/project_map/authoring/card_draft.js`. The CLI writes only an export
bundle and refuses output inside the loaded project repo; use `/tmp` for local
exports.

```bash
node tools/project_map/generate_card.js \
  --draft tools/project_map/fixtures/card_drafts/sample_action_card.json \
  --index /tmp/dendry_project_map/project-index.json \
  --out-dir /tmp/dendry_card_export \
  --summary
```

The bundle contains:

- `<id>.scene.dry`
- `<id>.card-draft.json`
- `<id>.install-notes.txt`

`cardKind: "action_card"` renders `is-card: true`; `cardKind:
"advisor_like"` renders `is-pinned-card: true` and uses profile labels in the
UI context. Unknown effect variables are rejected before export.

## Export a surface text proposal

The browser Surface Text template and CLI share
`tools/project_map/authoring/surface_text_draft.js`.

```bash
node tools/project_map/generate_surface_text.js \
  --draft tools/project_map/fixtures/surface_text_drafts/sample_label_replacement.json \
  --index /tmp/dendry_project_map/project-index.json \
  --out-dir /tmp/dendry_surface_text_export \
  --summary
```

The bundle contains:

- `<id>.surface-text-proposal.txt`
- `<id>.surface-text-draft.json`
- `<id>.install-notes.txt`

Source-backed labels can become guarded replacement proposals when their source
anchor is stable. Generated or custom runtime UI evidence, especially
`out/html`, must map back to source before Studio can install it.

## Smoke checks

```bash
python3 tools/project_map/build_project_map.py --root . --out /tmp/dendry_project_map/project-index.json --summary
python3 tools/project_map/build_project_map.py --root . --out /tmp/dendry_project_map/project-index-excerpts.json --summary --include-excerpts
node --check tools/project_map/parse_dry_project.js
python3 -m py_compile tools/project_map/build_project_map.py
python3 -m py_compile tools/project_map/launch_studio.py
node --check tools/project_map/viewer/app.js
node --check tools/project_map/viewer/wizard_ui.js
node --check tools/project_map/viewer/news_ui.js
node --check tools/project_map/viewer/card_ui.js
node --check tools/project_map/viewer/surface_text_ui.js
node --check tools/project_map/authoring/event_draft.js
node --check tools/project_map/authoring/news_draft.js
node --check tools/project_map/authoring/card_draft.js
node --check tools/project_map/authoring/surface_text_draft.js
node --check tools/project_map/generate_event.js
node --check tools/project_map/generate_news.js
node --check tools/project_map/generate_card.js
node --check tools/project_map/generate_surface_text.js
node --check tools/project_map/check_studio_surface.js
node --check tools/project_map/check_viewer_model.js
node --check tools/project_map/check_event_wizard_model.js
node --check tools/project_map/check_news_wizard_model.js
node --check tools/project_map/check_card_wizard_model.js
node --check tools/project_map/check_surface_text_model.js
node --check tools/project_map/check_project_map_fixture.js
node --check tools/project_map/check_desktop_shell.js
node --check tools/project_map/desktop/studio_core.js
node --check tools/project_map/desktop/main.js
node --check tools/project_map/desktop/preload.js
node --check tools/project_map/desktop/scripts/package_dir.js
node --check tools/project_map/desktop/scripts/package_portable.js
node --check tools/project_map/desktop/scripts/package_deb.js
node --check tools/project_map/check_desktop_packaging.js
node --check tools/project_map/check_desktop_deb.js
python3 tools/project_map/check_launch_studio.py
node tools/project_map/check_project_map_fixture.js --generic-mini
node tools/project_map/check_project_map_fixture.js --sdaah-mini
node tools/project_map/check_studio_surface.js
node tools/project_map/check_viewer_model.js /tmp/dendry_project_map/project-index.json --fixture-islands
node tools/project_map/check_viewer_model.js /tmp/dendry_project_map/project-index-excerpts.json --fixture-islands --expect-excerpts
node tools/project_map/check_event_wizard_model.js
node tools/project_map/check_news_wizard_model.js
node tools/project_map/check_card_wizard_model.js
node tools/project_map/check_surface_text_model.js
node tools/project_map/check_asset_model.js
node tools/project_map/check_preview_model.js
cd tools/project_map/desktop && npm run smoke
cd tools/project_map/desktop && npm run doctor
cd tools/project_map/desktop && npm run dist:linux
```

Expected-failure guard checks:

```bash
python3 tools/project_map/build_project_map.py --root . --out out/html/project-index.json
python3 tools/project_map/build_project_map.py --root . --out /tmp/dendry_project_map/bad.json --include-excerpts --excerpt-context-lines 99
```

Both commands should exit non-zero without writing a Project Map file.

## Fixture note

For an original SDAAH checkout, use:

```bash
python3 tools/project_map/build_project_map.py --root /path/to/SDAAH --out /tmp/dendry_project_map/sdaah-project-index.json --summary
```

Expected profile behavior: `generic-dendry` plus `sdaah-style`.

Optional external SDAAH smoke:

```bash
SDAAH_FIXTURE_ROOT=/path/to/SDAAH node tools/project_map/check_project_map_fixture.js --sdaah-fixture-root
DMS_SDAAH_FIXTURE_ROOT=/path/to/SDAAH node tools/project_map/check_sdaah_install_write_smoke.js
```

`check_sdaah_install_write_smoke.js` copies the SDAAH checkout to
`/tmp/dms_sdaah_install_write_*`, builds a ProjectIndex for the copy, then
dry-runs and applies Event / SDAAH monthly news-as-event / Card / Text Corpus /
existing event / guarded event-chain edits there, and verifies status/sidebar
generated/custom Surface Text remains a protected System UI boundary.
It verifies the original SDAAH checkout remains unchanged.
