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

<!-- DRAFT: the items below are placeholders summarizing the broad themes of the
accumulated work. Replace each with finalized, verified release copy before
publishing. Do not ship this section as-is. -->

### Home Hub — TODO

A full-screen Home dashboard now unifies Studio status, announcements,
templates, publish, and a "What's New" reading panel. _(TODO: finalize copy.)_

### What's New panel and version ceremony — TODO

A dedicated What's New reading panel and an opening ceremony that plays once per
version update. _(TODO: finalize copy.)_

### Authoring coverage at text-editor parity — TODO

The editor now covers the real authoring workflows audited on production mods
(system-UI sidebar apply, over-cap magic blocks, qdisplay, deferred branches,
card "Create Similar"). _(TODO: finalize copy.)_

### UI/UX baseline and density pass — TODO

A broad UI/UX pass: density tightening, default-collapsed structural sections,
empty/loading/error states with retry, display purification, and dark-mode
token adaptation. _(TODO: finalize copy.)_

## Known Limitations

- This is still an unsigned preview build. Please keep backups of real
  projects, review install plans before applying changes, and report any
  confusing editor behavior or broken preview output.
- _(TODO: confirm the limitations list for v0.98.5 before publishing.)_
