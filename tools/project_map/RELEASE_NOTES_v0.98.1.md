# Dendry Mod Studio v0.98.1 Dev Preview Notes

Date: 2026-05-29

## Status

v0.98.1 is an unsigned developer-facing preview build. It is a maintenance and
internal-hardening patch on the v0.98 preview line. It carries forward the
spatial canvas LOD zoom, drag-to-snap card stacking, music asset editing, and
all previous route-understanding, guided editing, object editor, install
review, Runtime Preview, Starter Demo, and governance work.

Release artifacts use these names:

- `DendryModStudio-win-x64.exe`
- `DendryModStudio-linux-x64.AppImage`
- `DendryModStudio-linux-x64.deb`

GitHub Actions builds all three through the `Desktop Release` workflow. A local
Linux build writes AppImage and Deb files under
`tools/project_map/desktop/dist-builder/`; these are ignored local outputs and
must be rebuilt and retested before sharing.

## What Changed Since v0.98

v0.98.1 has no new user-facing features. It bundles internal architecture and
governance hardening completed since the v0.98 preview:

- **Architecture ownership contract**: `ARCHITECTURE.md` documents surface and
  module ownership boundaries.
- **Complexity-budget ratchet**: a one-way downward source-complexity budget
  that cannot be raised, guarded by its own model check.
- **Data-driven CI**: `check:ci` runs an ordered `ciSequence` from
  `tool_registry.json` through a single runner, validated by registry and
  governance-parity checks.
- **Dead-surface removal**: the unreachable Spatial Canvas surface was removed;
  the storyboard view toggle now offers Timeline and Chain only.
- **Editor module extraction**: the asset-editor group was extracted into a
  `preview_asset_editor` sibling module.

## Known Limitations

- Card stacking is a visual organization aid and is not persisted across
  sessions. Stack membership lives in the runtime workspace state only.
- The LOD system uses `prefers-reduced-motion` to keep `will-change` permanent
  on weak hardware (smooth but potentially blurry text).
- This is still an unsigned preview build. Please keep backups of real
  projects, review install plans before applying changes, and report any
  confusing editor behavior or broken preview output.
