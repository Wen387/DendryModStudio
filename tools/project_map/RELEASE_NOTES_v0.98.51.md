# Dendry Mod Studio v0.98.51 Dev Preview Notes

Date: 2026-06-14

v0.98.51 is a small bug-fix patch on the v0.98.5 developer preview. It carries
forward everything in v0.98.5 and fixes four issues found in hands-on testing.

## Fixes

- **Guided tour & opening splash timing.** Both now appear consistently — on a
  fresh first run and after an update. A patch update no longer replays the
  guided tour; a minor or major update still does. The version-ceremony splash
  continues to play once per version.
- **Progress overlay on project reopen.** Switching or reloading a project now
  shows the rebuild progress overlay for the entire scan, not only on the first
  open of a project.
- **Play-test starting state accepts text.** Quality inputs in the in-place
  play-test take `true` / `false` (parsed as booleans), numbers (kept numeric),
  and quality names (kept as references), instead of silently coercing every
  non-number to `0`.
- **System-UI title/author opens Game Info.** Clicking the screen-header game
  title / author region now opens the Game Info (project metadata) editor with
  the game title and author fields, instead of a single event-title field.

## Status & Artifacts

This remains an unsigned developer-facing preview build on the v0.98 line.
Release artifacts use these names:

- `DendryModStudio-win-x64.exe`
- `DendryModStudio-linux-x64.AppImage`
- `DendryModStudio-linux-x64.deb`

GitHub Actions builds all three through the `Desktop Release` workflow. A local
Linux build writes AppImage and Deb files under
`tools/project_map/desktop/dist-builder/`; these are ignored local outputs and
must be rebuilt and retested before sharing.
