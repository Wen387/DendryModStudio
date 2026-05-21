# Dendry Mod Studio v0.97.8 Dev Preview Notes

Date: 2026-05-21

## Status

v0.97.8 is an unsigned developer-facing preview build. This local draft carries
the current route-understanding, guided editing, object editor, install review,
Runtime Preview, Starter Demo, and governance work while keeping the faster
desktop packaging layout from earlier previews.

Release artifacts use these names:

- `DendryModStudio-win-x64.exe`
- `DendryModStudio-linux-x64.AppImage`
- `DendryModStudio-linux-x64.deb`

GitHub Actions builds all three through the `Desktop Release` workflow. A local
Linux build writes AppImage and Deb files under
`tools/project_map/desktop/dist-builder/`; these are ignored local outputs and
must be rebuilt and retested before sharing.

## What Changed Since the Previous Preview

- Route Map now understands more DendryNexus route semantics, including
  multi-valid `go-to` randomization, `go-to-ref` dynamic bindings, utility
  call/return evidence, scheduler context, and runtime-observed route evidence.
- Guided route editing adds safe entries for utility pair edits, finite route
  table/Q binding target edits, and explicit fallback suggestions where the
  predicate can be made mutually exclusive.
- The event object editor now presents player-facing choice paths as nested
  branches, keeping option text, conditions, effects, route targets, and result
  sections closer to the choice that owns them.
- Existing event edits use same-source-unit coalescing before Review & Apply,
  so nearby result text, media, effect, and follow-up option edits become one
  stable source-backed section replacement when the evidence is exact.
- Runtime Preview copies source image assets into temporary preview projects
  and patches the DendryNexus `face-image`/runtime CSS mismatch used by several
  real projects.
- The bundled Starter Demo is now a small playable civic office loop with time,
  status/sidebar values, cards, advisors, conditional events, news-like beats,
  routeable choices, and editable illustration assets.
- Variable and metadata editing surfaces have clearer right-side draft state and
  more focused install review behavior.
- Canvas surfaces share smoother viewport behavior and a calmer zoom/scale
  transition.
- The package metadata and desktop manifest now report semver `0.97.8`; the
  user-facing release label is `v0.97.8`.

## Known Limits

- The Windows installer, Linux `.deb`, and Linux AppImage are unsigned preview
  artifacts.
- Structural deletion, arbitrary JS, opaque Q expressions, protected router
  files, and source spans without reliable anchors remain manual review
  boundaries.
- Guided route edits only operate on parser/profile-backed source evidence.
  They do not rewrite arbitrary JavaScript or infer project-specific schedulers
  without profile evidence.
- Runtime Preview Focused Entry proves a scene path can run in a temporary
  preview build; it does not prove every project scheduler or router path is
  wired.
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
