# Dendry Mod Studio

Dendry Mod Studio is a local authoring and review tool for Dendry / DendryNexus projects. It can scan a project, show Explore and Design views, create proposal-first edits, review install plans, and run desktop-only guarded dry-runs for supported changes.

This repository is a clean standalone export of the Studio code. It intentionally does not include the IslandSunrise game source, local LLM memory, session logs, generated runtime output, package artifacts, or the previous game repository Git history.

## Layout

- `tools/project_map/` contains the Studio viewer, authoring models, desktop shell, schemas, fixtures, QA scenarios, and checks.
- `studio_contract/` contains the current IslandSunrise compatibility contract and parser fixture used by Studio compatibility checks.
- `PUBLIC_EXPORT_MANIFEST.json` records what was included and which private roots were excluded.

## Local Use

```bash
python3 tools/project_map/launch_studio.py --no-open
```

For the desktop shell:

```bash
cd tools/project_map/desktop
npm install
npm run start
```

## Public Export Gate

Install root dependencies before running parser-backed checks:

```bash
npm install
```

Before pushing or making this repository public, run:

```bash
node tools/project_map/check_public_export.js
node tools/check_studio_contract.js --fixture-only
node tools/project_map/check_localization_surface.js
node tools/project_map/check_studio_surface.js
node tools/project_map/check_update_notice_model.js
node tools/project_map/check_starter_demo_model.js
node tools/project_map/check_player_like_qa_model.js
git status --short
git log --oneline --max-count=3
```

The first public commit should be a fresh initial Studio commit. Do not import the old game repository history.
