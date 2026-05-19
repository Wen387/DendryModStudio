# Dendry Mod Studio v0.97.5 Dev Preview Notes

Date: 2026-05-16

## Status

v0.97.5 is an unsigned developer-facing preview build. This local draft carries
the current authoring, Runtime Preview, Runtime Lens, and governance work while
keeping the faster Windows installer layout from the previous preview.

Release artifacts use these names:

- `DendryModStudio-win-x64.exe`
- `DendryModStudio-linux-x64.AppImage`
- `DendryModStudio-linux-x64.deb`

GitHub Actions builds all three through the `Desktop Release` workflow. A local
Linux build writes AppImage and Deb files under
`tools/project_map/desktop/dist-builder/`; these are ignored local outputs and
must be rebuilt and retested before sharing.

## What Changed Since the Previous Preview

- Object Canvas, Story Palette, and Storyboard workflows now cover more
  proposal-first authoring paths.
- Existing-content editing has stronger source-backed evidence and clearer
  Review & Apply boundaries.
- Complex Event Builder, route/effect workflows, and parser-backed draft
  conversion have broader guardrail coverage.
- Runtime Preview, Runtime Lens, and preview message handling have stronger
  lifecycle checks.
- The bundled Starter Demo and player-like QA paths cover more first-run and
  template-mod scenarios.
- The package metadata and desktop manifest now report semver `0.97.5`; the
  user-facing release label is `v0.97.5`.

## Known Limits

- The Windows installer, Linux `.deb`, and Linux AppImage are unsigned preview
  artifacts.
- Structural deletion, arbitrary JS, opaque Q expressions, and source spans
  without reliable anchors remain manual review boundaries.
- The update notice system is informational only. It opens manual download,
  release-note, or feedback links after a user action; it does not silently
  download or install updates.
- Clean-machine QA is still required before calling this public-release ready.

## Recommended QA Before Sharing

Run the automated checks from the repository root:

```bash
npm run check:ci
npm run check:complexity
```

Run the desktop checks from the desktop package directory:

```bash
cd tools/project_map/desktop
npm run smoke
npm run doctor
```

Build the fresh package from the new version:

```bash
npm run dist:win
npm run dist:linux
```

Record the exact artifact path, test date, operating system, install duration,
and whether an older Studio preview was already installed before calling this
package ready for invitee testing.
