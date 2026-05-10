# Dendry Project Map

Read-only tooling for inspecting a Dendry/DendryNexus project.

For development workflow, smoke tiers, packaging hygiene, and contributor
boundaries, see `tools/project_map/WORKFLOW.md`.

## Repository Layout

This directory contains the shared Project Map scanner, browser viewer, desktop
shell, authoring helpers, templates, compatibility fixtures, and repeatable QA
checks used by Dendry Mod Studio.

UI direction note: v0.5.5 adopts the **Direction B / Studio** surface for the
normal Explore / Create / Install workspace, with a Branch mark, grouped
Explore navigation, and tabbed Create output previews. v0.7 uses the
graph-first **Direction C / Atelier** concept only inside the Design tab.
v0.65 expands Create mode with export-only **Card / Advisor-like** and
**Surface Text** proposals. Generic Dendry / SDAAH-style projects say
Advisor(s), while the Island's Sunrise profile says Circle(s). Surface Text
indexing can point at source-backed labels and IDE-only `out/html` evidence,
but it still never auto-edits generated/custom runtime UI. v0.66 adds an
**Install Assistant** foundation: every authoring bundle now includes an
install-plan JSON and patch preview, and source-backed surface-label proposals
can be dry-run or applied by a guarded CLI. v0.66.1 makes that easier to read
by surfacing an operation checklist in the Studio and CLI summaries. v0.67 adds
the first **Existing Content Editing Bridge**: Explore inspectors for Events,
Cards, News, and Surface Text can seed the matching Create draft or show an
explicit IDE escape hatch. This is best-effort draft seeding, not full
round-trip raw `.dry` editing. The v0.67 completion pass adds an in-Studio
Install mode, Coverage Map, and more concrete Card hand/sidebar wiring
proposals. v0.7 adds the **Direction C Graph Design** workspace: a read-only
dark graph canvas for cruising project content and comparing against an
optional baseline ProjectIndex. v0.75 makes Coverage Map explicit about what
can be done inside Studio, what is guided IDE work, and what remains out of
scope. v0.76 adds `Edit Text Proposal` from Explore and Design inspectors, reusing
the Text Replacement / SurfaceTextDraft proposal flow for existing titles, news
headlines, and source-backed labels. It also turns Coverage Map into a beginner
task router with a First Mod Roadmap, no-code completion labels, and explicit
remaining gaps; Install mode adds a Finish this mod readiness card; Create outputs
show a lightweight player-facing preview before code/snippet/diff. It is not a full
runtime game preview, WYSIWYG editor, or raw `.dry` round-trip editor. v0.8.7
adds a small Draft Workspace inside Create: drafts can be saved in Studio,
reopened later, and sent straight to Install review; Install results now show a
readable report with rollback notes instead of only raw JSON. v0.8.8 adds
Meaning Layer previews and a more human Review & Apply install surface, moving
internal terms such as `ide_escape_hatch` into advanced details. v0.8.9 adds
the Event Workbench: selecting an event in Explore or Design shows player text,
conditions, effects/variables, related flow, and modification entry points before
showing source paths or raw `view-if`. Its three main actions now open real
flows: rewrite player text becomes a Text proposal, while alternate timeline and
follow-up actions become World Event drafts. They remain proposal-only until
reviewed in Install. v0.9 adds first-run **Quick Start** onboarding, available
again from topbar More, and expands zh-Hant localization coverage across the
Studio shell, onboarding flow, Event Workbench copy, and Create wizard controls.
Runtime Preview Sandbox adds a desktop-only Review & Apply action that builds
temporary baseline/modified copies and opens a localhost comparison page; it
does not build or patch the real project folder. Runtime Preview Debug Console
is preview-only: it can adjust ProjectIndex-known variables and jump to
ProjectIndex-known scenes inside the temporary modified preview, but it does
not edit source files, real saves, baseline output, or execute arbitrary JS.
v0.9.3 also adds an **Announcement Preview MVP**: the desktop app can poll a
static `update_manifest.json` URL, show the latest unread announcement as a
banner, and keep the full notice feed in a three-section in-app preview:
Updates & History, Announcements, and Testing & Contact. It opens
release/download/feedback links only when the user clicks them; it does not
silently download, install, or identify a device.

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
- stays read-only/export-only and does not edit `source/`, `out/game.json`, or `out/html/`.

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
The desktop package version is now `0.9.66` to match the current dev preview
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
- keeps Create mode / the World Event Wizard / News Wizard / Card Wizard /
  Surface Text proposals export-only.
- in desktop mode, can dry-run or apply only install-plan operations classified
  as safe apply.
- in desktop mode, can create a Runtime Preview sandbox: baseline and modified
  temporary copies are built separately, the install plan is applied only to the
  modified copy, and a `127.0.0.1` compare page shows original versus modified.

Current v0.9.66 limits:

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
- the shell does not write `source/`, `out/game.json`, or `out/html/`;
- export bundles now include install plans and patch previews; router / wiring
  work only becomes installable when a plan has explicit anchor and dedupe evidence.
- news snippets target `source/scenes/post_event_news.scene.dry`; the Studio can
  dry-run / apply guarded inserts for known post_event_news anchors, while
  missing-anchor or ambiguous dense-router cases remain manual review.
- card scene creation can be represented as a safe create-file operation, but
  hand/deck/sidebar wiring remains manual review.
- source-backed surface-text replacement can be dry-run / applied by
  `apply_install_plan.js`; `out/html` evidence always remains an IDE escape
  hatch and is never auto-mutated.
- Edit as Draft seeds new proposal drafts from existing indexed rows; it does
  not reconstruct full scene bodies/effects and does not overwrite the original
  row.
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
- Design mode is read-only, graph-first, and compares ProjectIndex rows by
  stable keys plus optional source fingerprints. Missing fingerprints or
  low-confidence evidence are marked unknown, not changed.
- Coverage Map is the current coverage truth surface: Events / News / Cards /
  Surface Text are draft/proposal workflows; hand/sidebar/raw routers are
  guided IDE escape hatches; image/audio assets are proposal-first. Assets view
  now has gallery cards, inspector image/audio preview, usage refs, reference
  helpers, missing-file repair proposals, and PreviewModel `assetRefs` display.
  PreviewModel marks assetRefs missing from the ProjectIndex asset list before
  review. Desktop `copy_asset_file` can guarded-copy a local file only when the
  plan has a sourcePath and passes hash/conflict checks; browser/no-sourcePath
  requests remain manual review. Studio still does not optimize, convert, or crop
  asset files. Preview readiness is exposed by
  `ProjectMapPreviewModel` as `ready_to_review`, `needs_review`, or
  `manual_review`; it is an authoring confidence signal, not runtime proof.
- v0.9.66 keeps the v0.9.65 authoring surface and improves Windows installer
  performance by packing Electron-readable JavaScript dependencies into
  `app.asar`. The parser remains available from the packaged app, while Python
  runtime resources, profiles, templates, and the Python indexer stay as loose
  files. The authoring model remains heuristic: unusual source layouts, opaque
  JS, and structural edits without reliable source spans must stay manual
  review.
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

See `tools/project_map/desktop/PACKAGING_NOTES.md` for the v0.9.66 packaging
boundary and `tools/project_map/RELEASE_NOTES_v0.9.66.md` for the tester-facing
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
Coverage Map summarizes which categories are safe apply, export-only,
manual-review, or IDE-only. Events, Cards, News, and Surface Text inspectors
also expose `Edit as Draft`.
That action switches to Create mode and loads a best-effort draft seed; partial
or IDE-only cases stay visibly marked rather than being treated as finished
edits.

Design mode shows the same project through a Direction C / Atelier graph canvas.
Timeline Events, Cards / Advisor-like, News, Surface Text / Sidebar, and Manual
Review / Escape Hatch are filterable node categories rather than the main
layout. It can load a second ProjectIndex as an original/baseline index. Nodes
are marked `same`, `changed`, `added`, `missing from current`, `unknown`, or
`no baseline`; `changed` only appears when both sides have strong source
fingerprints. Design Inspector actions reuse `Edit as Draft` and `Open in
Explore`; no source file is installed from Design mode.

Create mode contains the v0.4.3 World Event Wizard, v0.6 News Wizard, and v0.65
Card / Surface Text templates, with v0.66 install-plan and patch-preview output.
The World Event Wizard can
load an existing
`EventDraft v0.1` JSON, edit 2-4 choices, edit advanced fields such as
`seenFlag`, trigger effects, `chooseIf`, variants, and custom continuation
anchors, preview generated `.scene.dry`, draft JSON, root init snippet,
post_event migration snippet, install notes, and patch preview. The News Wizard can load a
`NewsDraft v0.1` JSON, generate dated `Q.news_1/2/3` snippets or background
pool `.push({n, d})` snippets, preview snippet / draft JSON / install notes / patch preview,
and download an export bundle. The Card Wizard can generate action-card or
advisor-like `.scene.dry` proposals with 2-4 choices, choose-if, unavailable
text, and simple Q effects. The Surface Text template exports replacement
proposals or IDE escape-hatch notes for labels such as `資源 -> 資金`; source-backed
labels can be passed through the guarded Install Assistant CLI.

Manual walkthrough:

1. Open `tools/project_map/viewer/index.html`.
2. Select `/tmp/dendry_project_map/project-index-excerpts.json`.
3. Confirm Overview renders, source badges open excerpts, diagnostics groups
   show examples, and scene incoming/outgoing endpoints navigate the inspector.
4. Switch to Create, fill the World Event Wizard, adjust the choice count, and
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
   IDE-only escape hatch notes are distinct.
10. Open the Patch preview tab in any Create template; confirm it shows the
    generated install-plan proposal before downloading.
11. Return to Explore, select an Event, Card, News item, or Surface Text row,
    click `Edit as Draft`, and confirm Create mode opens with the matching
    draft template loaded.
12. Open Coverage Map and confirm it distinguishes safe apply from manual
    review.
13. Switch to Design, confirm the dark Direction C graph canvas renders, select
    an Event / Card / News / Surface Text node, and confirm `Edit as Draft`
    opens Create.
14. Load a baseline ProjectIndex in Design and confirm low-confidence or
    fingerprint-less matches are marked unknown rather than changed.
15. Open Install, load a generated `*.install-plan.json`, review the operation
    checklist, and in desktop mode run dry-run before applying safe operations.

## Install Assistant v0.67

Every Event / News / Card / Surface Text bundle now includes:

- `<id>.install-plan.json`
- `<id>.patch-preview.diff`
- `<id>.install-notes.txt`

Studio Install mode shows an operation checklist with separate
`Safe apply`, `Manual review`, and `Protected / refused` sections. In the
desktop shell it can dry-run or apply only safe operations; in the raw browser
viewer it remains a review surface and points users to the CLI.

The install plan separates `safe_apply` operations from `manual_review`
operations. Current safe operations are deliberately narrow:

- `create_file` for new Event / Card scene proposals.
- `replace_text` for source-backed Surface Text labels when the original text
  still matches exactly.

Manual-review operations stay manual: root init snippets, `post_event` migration
guards, `post_event_news` snippets, hand/deck/sidebar wiring, and all `out/html`
evidence. Card exports now include a concrete wiring proposal pointing at the
hand/sidebar review file, but that operation is still `manual_review`.

Dry-run an install plan:

```bash
node tools/project_map/apply_install_plan.js \
  --plan /tmp/dendry_surface_export/<id>.install-plan.json \
  --root . \
  --summary
```

Apply only the safe operations after reviewing the patch preview:

```bash
node tools/project_map/apply_install_plan.js \
  --plan /tmp/dendry_surface_export/<id>.install-plan.json \
  --root . \
  --apply \
  --summary
```

The CLI refuses paths outside the project root, `.git`, `out/game.json`, and
`out/html/`. It never applies `manual_review` operations.

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

The install notes now list bundle files, the suggested source path, and manual
root/post_event installation steps. They are intentionally instructions, not an
auto-apply patch.

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
dedupe token; otherwise it stays a manual proposal.

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

Source-backed labels are exported as manual replacement proposals. Generated or
custom runtime UI evidence, especially `out/html`, is exported as an IDE escape
hatch with path, line, original label, replacement label, and rationale.

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
node --check tools/check_studio_contract.js
python3 tools/project_map/check_launch_studio.py
node tools/project_map/check_project_map_fixture.js --generic-mini
node tools/project_map/check_project_map_fixture.js --sdaah-mini
node tools/check_studio_contract.js
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

Expected profile behavior: `generic-dendry` plus `sdaah-style`. Island's
Sunrise additionally enables `islands-sunrise`.

IslandSunrise / Studio split coordination lives in `studio_contract/`. Before
changing IslandSunrise profile detection, parser assumptions, router handling,
or protected-boundary behavior, run:

```bash
node tools/check_studio_contract.js
```

This contract fixture is intentionally smaller than the full game. It keeps the
profile chain and stable parser expectations testable after Studio moves to its
own repository.

Optional external SDAAH smoke:

```bash
SDAAH_FIXTURE_ROOT=/path/to/SDAAH node tools/project_map/check_project_map_fixture.js --sdaah-fixture-root
DMS_SDAAH_FIXTURE_ROOT=/path/to/SDAAH node tools/project_map/check_sdaah_install_write_smoke.js
```

`check_sdaah_install_write_smoke.js` copies the SDAAH checkout to
`/tmp/dms_sdaah_install_write_*`, builds a ProjectIndex for the copy, then
dry-runs and applies Event / SDAAH monthly news-as-event / Card / Text Corpus /
existing event / guarded event-chain edits there, and verifies status/sidebar
Surface Text remains a manual System UI boundary.
It verifies the original SDAAH checkout remains unchanged.
