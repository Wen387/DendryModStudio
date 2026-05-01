# Dendry Mod Studio Agent Guide

This repository is the source of truth for Dendry Mod Studio. Work here for
Studio changes; do not edit the older `tools/project_map/` copy inside the
IslandSunrise game repository unless the task is explicitly about exporting or
comparing repository state.

## Scope

- Studio source lives under `tools/project_map/`.
- Desktop packaging lives under `tools/project_map/desktop/`.
- Compatibility fixtures live under `studio_contract/`.
- Public release preparation notes live under `docs/releases/`.

The repository intentionally excludes private notes, full game project source,
generated runtime output, local fixture checkouts, package artifacts, and the old
game repository history.

## Required Checks

From the repository root:

```bash
npm ci --ignore-scripts
npm run check:ci
```

For desktop work, also run these from `tools/project_map/desktop/` after
installing desktop dependencies:

```bash
npm ci
npm run smoke
npm run doctor
```

For Linux release packaging checks:

```bash
npm run dist:linux
```

GitHub Actions builds Windows and Linux release artifacts through
`.github/workflows/release.yml`.

## Safety Boundaries

- Browser mode is review-only.
- Desktop mode may dry-run or apply only operations classified as safe, guarded,
  or explicitly advanced.
- Manual-review and refused operations must not be applied automatically.
- Runtime Preview must use temporary baseline and modified copies, not the real
  project folder.
- Generated runtime output such as `out/html`, `out/game.json`, and `.git`
  stays protected from automatic edits.

## Contribution Hygiene

- Do not commit `node_modules/`, `dist/`, `dist-builder/`, `.env*`, logs,
  private notes, SSH keys, access tokens, copied game projects, or local package
  artifacts.
- Keep user-facing UI changes bilingual. Run
  `node tools/project_map/check_localization_surface.js` after changing visible
  Studio text.
- Keep the bundled Demo Template runnable. Run
  `node tools/project_map/check_starter_demo_model.js` after changing
  `tools/project_map/templates/starter-demo/`.
- Keep IslandSunrise compatibility coordinated through `studio_contract/`. Run
  `node tools/check_studio_contract.js --fixture-only` after changing profiles,
  parser assumptions, router handling, or protected-boundary behavior.
- Optional full SDAAH smoke tests require an external checkout and should use
  `DMS_SDAAH_FIXTURE_ROOT=/path/to/SDAAH`.
