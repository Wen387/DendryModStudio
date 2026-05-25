# Dendry Mod Studio v0.98 Dev Preview Notes

Date: 2026-05-25

## Status

v0.98 is an unsigned developer-facing preview build. This local draft carries
the spatial canvas LOD zoom, drag-to-snap card stacking, music asset editing,
and all previous route-understanding, guided editing, object editor, install
review, Runtime Preview, Starter Demo, and governance work.

Release artifacts use these names:

- `DendryModStudio-win-x64.exe`
- `DendryModStudio-linux-x64.AppImage`
- `DendryModStudio-linux-x64.deb`

GitHub Actions builds all three through the `Desktop Release` workflow. A local
Linux build writes AppImage and Deb files under
`tools/project_map/desktop/dist-builder/`; these are ignored local outputs and
must be rebuilt and retested before sharing.

## What Changed Since v0.97.8

- **Content Storyboard LOD zoom**: 4-level CSS-driven Level of Detail system
  (chip / overview / working / full detail) with fixed font sizes at each
  breakpoint, deferred LOD updates during zoom for smooth animation, and
  dynamic GPU promotion (`will-change: transform`) that clears after settle
  for crisp text rasterization. Minimum zoom lowered to 10% for bird's-eye
  navigation.

- **Drag-to-snap card stacking**: physical card overlap like real playing
  cards. Drag a card near another to stack it; the anchor card's title peeks
  out below. Dragging the bottom card moves the entire group as a unit.
  Individual member cards can be peeled off by dragging from the top.
  Stack-aware snap detection excludes same-stack peers, scales the threshold
  by zoom for consistent screen-space feel, and scopes to the same timeline
  lane to prevent cross-lane snap. Nested stacks auto-redirect to the root
  anchor. Cancelled drags restore DOM positions.

- **Stack z-index ordering**: stacked cards render with correct layer order
  (anchor behind, members in front) via inline z-index computed from stack
  membership.

- **Music asset editing**: audio modifier extraction in the indexer, set-music
  directive support in the model layer, Object Canvas audio player with
  modifier badges, Explore gallery audio modifier display.

## Known Limitations

- Card stacking is a visual organization aid and is not persisted across
  sessions. Stack membership lives in the runtime workspace state only.
- The LOD system uses `prefers-reduced-motion` to keep `will-change` permanent
  on weak hardware (smooth but potentially blurry text).
- This is still an unsigned preview build. Please keep backups of real
  projects, review install plans before applying changes, and report any
  confusing editor behavior or broken preview output.
