# Dendry Mod Studio v0.9.65 Dev Preview Notes

Date: 2026-05-09

## Status

v0.9.65 is an unsigned developer-facing preview build. This local draft gathers
the current editing-workflow, Dynamic Mod compatibility, and release-prep polish
for final review before packaging.

Release artifacts use these names:

- `DendryModStudio-win-x64.exe`
- `DendryModStudio-linux-x64.AppImage`
- `DendryModStudio-linux-x64.deb`

GitHub Actions builds all three through the `Desktop Release` workflow. A local
Linux build writes AppImage and Deb files under
`tools/project_map/desktop/dist-builder/`; these are ignored local outputs and
must be rebuilt and retested before sharing.

## What Changed Since v0.9.6

- Existing Event editing now has a narrower automatic install path for simple,
  source-backed option effects. Broad structural edits still stay manual review.
- Complex event parsing and previewing are clearer for inline conditionals,
  follow-up sections, owned options, and option-result effects.
- Election-result authoring has been polished around D3 parliament screens while
  presidential election flows remain routed through the regular event editor.
- The release metadata and desktop manifest now report `0.9.65`.

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

Record the exact artifact path, test date, operating system, and whether an
older Studio preview was already installed before calling this package ready for
invitee testing.
