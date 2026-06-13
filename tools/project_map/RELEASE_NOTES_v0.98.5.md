# Dendry Mod Studio v0.98.5 Dev Preview Notes

Date: 2026-06-13

> **DRAFT — version-number scaffold.** This file exists so the version bump
> keeps `check:ci` green (the release-links check derives this path from the
> package version). The feature copy below is a carried-forward skeleton; the
> final, user-facing release notes for v0.98.5 are the author's to write before
> publishing. Sections marked `TODO` need real copy.

## Status

v0.98.5 is an unsigned developer-facing preview build on the v0.98 preview
line. It is the version that closes out the large-scale engineering of the
v0.98 line. It carries forward all prior route-understanding, guided editing,
object editor, install review, Runtime Preview, Template Hub, publish, music
asset, and governance work.

Release artifacts use these names:

- `DendryModStudio-win-x64.exe`
- `DendryModStudio-linux-x64.AppImage`
- `DendryModStudio-linux-x64.deb`

GitHub Actions builds all three through the `Desktop Release` workflow. A local
Linux build writes AppImage and Deb files under
`tools/project_map/desktop/dist-builder/`; these are ignored local outputs and
must be rebuilt and retested before sharing.

## What Changed Since v0.98.1

### Home Hub

The welcome popup has been replaced by a persistent, full-screen Home Hub.
Overview, publishing, announcements, templates, and a What's New reading
panel share a single scrolling page; recent projects reopen with one click;
and the wordmark in the top-left corner returns you here from anywhere in
the tool. The first-run guided tour and its hands-on task now launch from
the Home Hub, giving newcomers one clear starting point.

### What's New panel and version introduction

A dedicated What's New panel presents each release as an illustrated
walkthrough — one block per feature, with screenshots — in place of a dense
changelog. The first launch after a version update plays a short visual
introduction before the panel opens automatically; you can reopen it any
time from the Home Hub.

### Authoring coverage at text-editor parity

The editor now handles the real authoring workflows I identified by auditing
production mods, closing the gap with hand-editing the source. Three changes
are structural: nested inline conditionals render as a navigable layered
tree, with a what-if simulator that resolves which branches a given state
would reach; the system-UI sidebar is now a directly editable surface whose
changes apply precisely to the underlying template; and you can play-test an
event in place using the real Dendry engine — scene art and music included,
startable from any upstream scene, re-rollable with a different seed.

A second group of additions closes smaller gaps that previously required
switching to the source file: over-cap magic blocks, qdisplay insertion,
asset replacement, long-event search, and a "Create Similar" action on
cards.

### UI/UX baseline

A broad pass across the full interface. Dark mode ships with three settings —
light, dark, and auto. The dark theme applies a warm charcoal palette to the
Studio shell; the content preview deliberately keeps its paper-toned
appearance so it stays true to the published look. Performance: large events
open roughly 5x faster than before. Throughout, the interface is tighter and
more predictable: structural sections collapse by default, empty / loading /
error states include retry affordances, duplicate signals have been removed,
and a persistent back control sits in the top bar.

## Known Limitations

- In-place play-test runs the real engine over your current edits, but it
  does not replace a full build: when you start mid-route, state from
  skipped upstream scenes is approximated, not replayed. Treat play-test
  results as directional, not authoritative.
- This is still an unsigned developer preview. Keep backups of real
  projects, review the install plan before applying changes, and report
  confusing editor behavior or broken preview output.
- The release workflow produces Windows and Linux builds only; on macOS,
  run Studio from source.
- Dark mode restyles the Studio shell only. The content preview keeps your
  mod's own look and does not follow the dark theme.
