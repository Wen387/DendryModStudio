# Dendry Mod Studio v0.9.2 Dev Preview Notes

Date: 2026-05-01

## Status

v0.9.2 is a developer-facing dev preview for Dendry Mod Studio. It is suitable
for local testing, mod-author workflow review, and invitee QA, but it is not a
signed public release yet.

Release artifacts use these names:

- `DendryModStudio-win-x64.exe`
- `DendryModStudio-linux-x64.AppImage`
- `DendryModStudio-linux-x64.deb`

GitHub Actions builds all three through the `Desktop Release` workflow. A local
Linux build writes AppImage and Deb files under
`tools/project_map/desktop/dist-builder/`; these are ignored local outputs and
must be rebuilt and retested before sharing.

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
- Announcement Preview MVP: desktop builds can poll a hosted static
  `update_manifest.json`, show the newest unread item as a banner, and keep a
  readable in-app notice preview split into Updates & History, Announcements,
  and Testing & Contact, with manual download, release-note, or feedback links.

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

- Fresh-package QA is not complete. A human still needs to run the beginner
  path from a fresh package: Quick Start, Tutorial Library, open/load project,
  create a proposal, save to My Changes, review, dry-run, apply, and inspect the
  result.
- The Linux `.deb`, Linux AppImage, and Windows installer are unsigned preview
  artifacts. Python 3 is still a system requirement.
- Announcement Preview / Update Notice MVP is not an auto-updater. It does not
  silently download, install, or identify a device; it only fetches a static
  HTTP(S) manifest and opens links after the user clicks them. Hosted manifest
  reachability still needs to be checked before sharing a package.
- The app has not been clean-VM tested across Linux distributions, Windows, or
  macOS.
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
npm run check:ci
node tools/project_map/qa/run_desktop_scenario.js --scenario first_time_user
node tools/project_map/qa/run_desktop_scenario.js --scenario explore_design_existing_edit
node tools/project_map/qa/run_desktop_scenario.js --scenario draft_persistence_restart
node tools/project_map/qa/run_desktop_scenario.js --scenario load_bundled_demo_template
```

The guided UI QA scenarios write screenshots, `transcript.json`, and
`QA_LEDGER.md` under `/tmp/dendry_mod_studio_qa/`. They are smoke tests for the
real Studio UI, including Open Project through the test dialog adapter and the
Explore -> Design -> Edit existing path. They also cover a returning-author
draft persistence path by reloading the Studio renderer with the same Electron
user data, reopening the saved draft from My Changes, and dry-running the
persisted install plan. The bundled demo scenario covers Quick Start -> Demo
Template -> writable app-data project -> demo event / variable inspection. These
are not replacements for fresh artifact manual QA.

Run the desktop checks from the desktop package directory:

```bash
cd tools/project_map/desktop
npm run smoke
npm run doctor
npm run dist:linux
```

Then manually test the rebuilt package. The minimum manual path is:

1. Open the app from a clean AppImage, `.deb`, or Windows installer.
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
