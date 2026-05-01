# Dendry Mod Studio Public Workflow

This file is the standalone Studio workflow for the public/exported repository. It replaces the game-repo development notes in clean exports.

## Current Shape

- `tools/project_map/build_project_map.py` builds a ProjectIndex from a Dendry project.
- `tools/project_map/viewer/` is the browser Studio UI.
- `tools/project_map/desktop/` is the Electron shell and packaging spike.
- `tools/project_map/authoring/` contains proposal, preview, install-plan, and meaning-layer models.
- `tools/project_map/templates/starter-demo/` is the bundled demo project for first-time users.
- `studio_contract/` is the IslandSunrise compatibility contract fixture used to keep Studio parsing stable.

## Safe Boundaries

- Browser mode is review-only.
- Desktop mode can dry-run/apply only install-plan operations classified as safe, guarded, or explicitly advanced.
- Manual-review and refused operations are not applied.
- Runtime Preview builds temporary baseline/modified copies and does not patch the real project folder.
- Generated runtime output such as `out/html`, `out/game.json`, and `.git` is protected from automatic edits.

## Pre-Push Checks

Install root dependencies once:

```bash
npm ci --ignore-scripts
```

```bash
npm run check:ci
```

Desktop checks after `npm install` in `tools/project_map/desktop`:

```bash
npm run doctor
npm run smoke
```
