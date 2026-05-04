# Dendry Mod Studio v0.9.3 Dev Preview Notes

Date: 2026-05-04

## Status

v0.9.3 is an unsigned developer-facing preview build. It advances the package
version from v0.9.2 so Windows, Deb, and update-notice metadata can recognize a
real upgrade instead of another same-version rebuild.

Release artifacts use these names:

- `DendryModStudio-win-x64.exe`
- `DendryModStudio-linux-x64.AppImage`
- `DendryModStudio-linux-x64.deb`

GitHub Actions builds all three through the `Desktop Release` workflow. A local
Linux build writes AppImage and Deb files under
`tools/project_map/desktop/dist-builder/`; these are ignored local outputs and
must be rebuilt and retested before sharing.

## What Changed Since v0.9.2

- The root and desktop package versions are now `0.9.3`.
- Windows and Linux release builds fetch and package a bundled Python runtime
  before building desktop artifacts.
- The Windows NSIS installer includes a cleanup script for stale packaged app
  runtime and Project Map resources during upgrade installs.
- Windows app icons are now wired through the installer, uninstaller, packaged
  assets, and Electron window/taskbar identity.
- The bundled update manifest now reports `latestVersion` and
  `minimumRecommendedVersion` as `0.9.3`.

## Known Limits

- The Windows installer, Linux `.deb`, and Linux AppImage are unsigned preview
  artifacts.
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

Record the exact artifact path, test date, operating system, and whether the
previous v0.9.2 app was already installed before calling this package ready for
invitee testing.
