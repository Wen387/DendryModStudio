# Dendry Mod Studio v0.9.6 Dev Preview Notes

Date: 2026-05-08

## Status

v0.9.6 is an unsigned developer-facing preview build. This local draft gathers
the current editing-workflow polish for final review before packaging.

Release artifacts use these names:

- `DendryModStudio-win-x64.exe`
- `DendryModStudio-linux-x64.AppImage`
- `DendryModStudio-linux-x64.deb`

GitHub Actions builds all three through the `Desktop Release` workflow. A local
Linux build writes AppImage and Deb files under
`tools/project_map/desktop/dist-builder/`; these are ignored local outputs and
must be rebuilt and retested before sharing.

## What Changed Since v0.9.3

- The root and desktop package versions are now `0.9.6`.
- Create-mode editing is more oriented around authoring new content, including
  visible creation affordances for story follow-ups, counterfactuals, related
  cards, related news, and variable/project-state edits.
- The Object Authoring Canvas now uses denser command areas in the editor
  sidebars so Save, Review & Apply, object-editor launch, and related actions
  stay near the selected object.
- Runtime Lens and visible editor coverage diagnostics remain available for
  checking whether player-facing UI maps back to editable source objects.
- The bundled update manifest now reports `latestVersion` and
  `minimumRecommendedVersion` as `0.9.6`.

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
previous v0.9.3 app was already installed before calling this package ready for
invitee testing.
