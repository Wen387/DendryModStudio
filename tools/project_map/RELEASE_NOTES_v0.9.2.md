# Dendry Mod Studio v0.9.2 Dev Preview Notes

Date: 2026-05-01

## Status

v0.9.2 is a developer-facing dev preview for Dendry Mod Studio. It is suitable
for local testing, mod-author workflow review, and invitee QA, but it is not a
signed public release yet.

Current local artifacts, when built in this workspace, use these names:

- `tools/project_map/desktop/dist/DendryModStudio-linux-x64.tar.gz`
- `tools/project_map/desktop/dist/dendry-mod-studio_0.9.2_amd64.deb`

These files are ignored local outputs. Rebuild and retest them before sharing a
package outside the development machine.

## What This Preview Includes

- Project scanning for Island's Sunrise, generic Dendry projects, and
  SDAAH-style projects.
- Explore, Design, Create, My Changes, Review & Apply, Event Workbench, Text
  Corpus, Existing Scene Editor, Assets, Quick Start, and Tutorial Library.
- Desktop Quick Start can load a Demo Template. The app copies the bundled
  Starter Demo into Electron app data as a writable project, so first-time users
  can inspect a tiny event, option result text, variable effect, and `view-if`
  condition before opening their own mod.
- Proposal-first authoring for world events, news-style events, cards/advisors,
  surface text, single-line text replacements, and source-backed existing
  event/card edits.
- Guarded Review & Apply for safe or checkable operations, including anchored
  inserts, exact-line replacements, and desktop-only guarded asset copy when a
  local source path is available.
- Desktop Runtime Preview sandbox that builds temporary baseline/modified
  copies and serves a localhost comparison page.
- Preview-only Debug Console for ProjectIndex-known variables and scenes inside
  the modified temporary preview.
- Update Notice MVP: desktop builds can poll a hosted static
  `update_manifest.json` and show an in-app announcement or update banner with
  manual download / release-note links.

## Safety Boundary

Dendry Mod Studio still treats source changes as proposals first. Browser mode
is review-only. Desktop mode can dry-run or apply only operations that the
install plan classifies as safe, guarded, or explicitly advanced. Manual-review
and refused operations are not applied.

Runtime Preview does not build or patch the real project folder. It works inside
temporary copies under Electron user data and applies the plan only to the
modified preview copy.

The Studio does not mutate `out/html`, `out/game.json`, `.git`, or generated
runtime output. It also blocks install plans whose recorded project provenance
does not match the currently opened project root.

## Known Limits

- Public release QA is not complete. A human still needs to run the beginner
  path from a fresh package: Quick Start, Tutorial Library, open/load project,
  create a proposal, save to My Changes, review, dry-run, apply, and inspect the
  result.
- The Linux `.deb` and portable archive are feasibility artifacts, not signed
  production installers. Python 3 is still a system requirement.
- Update Notice MVP is not an auto-updater. It does not silently download,
  install, or identify a device; it only fetches a static HTTP(S) manifest and
  opens links after the user clicks them. Hosted manifest reachability still
  needs to be checked before sharing a package.
- The app has not been clean-VM tested across Linux distributions, Windows, or
  macOS. Windows packaging is not part of v0.9.2.
- Asset import is intentionally basic. The Studio can propose or guarded-copy a
  local file when desktop source-path evidence exists, but it does not optimize,
  crop, transcode, or manage persistent browser file handles.
- Existing Scene Editor can safely replace source-backed text and metadata
  lines with exact evidence. It is not a free-form raw `.dry` editor, JS effect
  editor, option reorder tool, or dense-router rewrite tool.
- Runtime Preview is a helpful preview aid, not proof of release correctness.
  It depends on the target Dendry runtime exposing the hooks the debug bridge can
  use; when hooks are missing, the console should show diagnostics instead of
  executing arbitrary code.
- Localization coverage is broad enough for current UI smoke checks, but release
  copy still needs a human pass for wording density and beginner clarity.

## Recommended QA Before Sharing

Run the automated checks from the repository root:

```bash
node tools/project_map/check_public_export.js
node tools/project_map/check_update_notice_model.js
node tools/project_map/check_starter_demo_model.js
node tools/project_map/check_player_like_qa_model.js
node tools/project_map/qa/run_desktop_scenario.js --scenario first_time_user
node tools/project_map/qa/run_desktop_scenario.js --scenario explore_design_existing_edit
node tools/project_map/qa/run_desktop_scenario.js --scenario draft_persistence_restart
node tools/project_map/qa/run_desktop_scenario.js --scenario load_bundled_demo_template
bash tools/build_and_validate.sh --skip-build --errors-only
```

The player-like QA scenarios write screenshots, `transcript.json`, and
`QA_LEDGER.md` under `/tmp/dendry_mod_studio_qa/`. They are smoke tests for the
real Studio UI, including Open Project through the QA dialog shim and the
Explore -> Design -> Edit existing path. They also cover a returning-author
draft persistence path by reloading the Studio renderer with the same Electron
user data, reopening the saved draft from My Changes, and dry-running the
persisted install plan. The bundled demo scenario covers Quick Start -> Demo
Template -> writable app-data project -> demo event / variable inspection. These
are not replacements for fresh artifact manual QA.

Run the desktop checks from the desktop package directory:

```bash
cd tools/project_map/desktop
npm run doctor
npm run smoke
npm run package:portable
npm run package:deb
```

Then manually test the rebuilt package. The minimum manual path is:

1. Open the app from a clean portable or `.deb` install.
2. Use Quick Start and Tutorial Library.
3. Load the bundled Demo Template once, then open an Island's Sunrise or
   SDAAH-style project.
4. Create one event/card/text proposal.
5. Save it to My Changes and reopen it.
6. Review & Apply with dry-run first.
7. Apply only guarded operations in a disposable project copy.
8. Open Runtime Preview and confirm the baseline/modified comparison is usable.

Record the exact artifact path, test date, operating system, and any skipped
steps before calling a package release-ready.
