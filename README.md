# Dendry Mod Studio

Dendry Mod Studio is a local authoring and review tool for Dendry and DendryNexus projects. It can scan a project, show Explore and Design views, create proposal-first edits, review install plans, and run desktop-only guarded dry-runs for supported changes.

This repository is a clean standalone export of the Studio code. It intentionally does not include the IslandSunrise game source, private project notes, session logs, generated runtime output, package artifacts, or the previous game repository Git history.

## Status

The current build is a `v0.9.2` developer preview. It is useful for local testing, authoring-flow review, and invitee QA, but it is not a signed public desktop release yet.

The code in this standalone Studio export is released under the MIT license.

## Layout

- `tools/project_map/` contains the Studio viewer, authoring models, desktop shell, schemas, fixtures, QA scenarios, and checks.
- `studio_contract/` contains the current IslandSunrise compatibility contract and parser fixture used by Studio compatibility checks.
- `PUBLIC_EXPORT_MANIFEST.json` records what was included and which private roots were excluded.

## Quick Start

Install the root dependencies once:

```bash
npm ci
```

Launch the browser viewer against a local project:

```bash
python3 tools/project_map/launch_studio.py --no-open
```

Then open the printed local URL in your browser.

For the Electron desktop shell:

```bash
cd tools/project_map/desktop
npm install
npm run start
```

First-time users can choose the bundled Demo Template from Quick Start. The desktop app copies that template into app data before opening it, so the packaged demo can be edited without mutating application resources.

## Safety Model

- Browser mode is review-only.
- Desktop mode can dry-run or apply only operations classified as safe, guarded, or explicitly advanced.
- Manual-review and refused operations are not applied.
- Runtime Preview builds temporary baseline/modified copies and does not patch the real project folder.
- Generated runtime output such as `out/html`, `out/game.json`, and `.git` is protected from automatic edits.

## Update Notices

The desktop app reads `tools/project_map/desktop/update_manifest.json` through a static raw GitHub URL. This is an announcement/update notice system, not a silent auto-updater. It opens release/download links only when the user clicks them.

## Useful Checks

```bash
npm run check:ci
```

The GitHub Actions workflow runs the same core checks on every push and pull request.
Release preparation notes live in `docs/releases/v0.9.2-dev-preview.md`.

## Public Export Gate

Before pushing or making this repository public, run:

```bash
npm run check:ci
git status --short
git log --oneline --max-count=3
```

The first public commit should be a fresh initial Studio commit. Do not import the old game repository history.

## Reporting Issues

When reporting a problem, include the Studio version, operating system, whether you used browser or desktop mode, and the action you were trying to complete. Do not upload private project notes, access tokens, SSH private keys, or full game save data unless you have reviewed them first.
