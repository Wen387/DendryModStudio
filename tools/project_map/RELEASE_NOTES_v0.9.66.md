# Dendry Mod Studio v0.9.66 Dev Preview Notes

Date: 2026-05-10

## Status

v0.9.66 is an unsigned developer-facing preview build. This local draft keeps
the v0.9.65 editing scope and focuses on Windows installer performance before
packaging.

Release artifacts use these names:

- `DendryModStudio-win-x64.exe`
- `DendryModStudio-linux-x64.AppImage`
- `DendryModStudio-linux-x64.deb`

GitHub Actions builds all three through the `Desktop Release` workflow. A local
Linux build writes AppImage and Deb files under
`tools/project_map/desktop/dist-builder/`; these are ignored local outputs and
must be rebuilt and retested before sharing.

## What Changed Since v0.9.65

- The normal Windows `dist:win` package now uses the faster `deps-in-asar`
  layout tested on Windows: root JavaScript dependencies and parser resources
  are packed into `app.asar` instead of installed as thousands of loose files.
- The desktop shell can load the parser from the packaged app while keeping the
  bundled Python runtime, Python indexer, profiles, and Starter Demo template as
  loose resources.
- Diagnostic Windows package variants remain available for install-performance
  comparisons, but the normal `DendryModStudio-win-x64.exe` now carries the
  optimized layout.
- The release metadata and desktop manifest now report `0.9.66`.

## Known Limits

- The Windows installer, Linux `.deb`, and Linux AppImage are unsigned preview
  artifacts.
- Windows Defender or other antivirus tools can still scan unsigned installers
  aggressively, especially inside virtual machines, but the number of loose
  files written during install is much lower than in v0.9.65.
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

Record the exact artifact path, test date, operating system, install duration,
and whether an older Studio preview was already installed before calling this
package ready for invitee testing.
