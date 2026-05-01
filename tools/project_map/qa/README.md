# Dendry Mod Studio Player-Like QA

This directory contains black-box-ish QA scripts that run the real Studio
viewer inside Electron, interact with visible UI/DOM, take screenshots, and
write a QA ledger.

The MVP runner is intentionally small:

```bash
node tools/project_map/qa/run_desktop_scenario.js --scenario first_time_user
node tools/project_map/qa/run_desktop_scenario.js --scenario explore_design_existing_edit
node tools/project_map/qa/run_desktop_scenario.js --scenario draft_persistence_restart
node tools/project_map/qa/run_desktop_scenario.js --scenario load_bundled_demo_template
```

By default it writes artifacts under `/tmp/dendry_mod_studio_qa/<run-id>/`.
Each run contains:

- `QA_LEDGER.md` — scenario result, shortcuts, and step table.
- `transcript.json` — structured step log plus browser console messages.
- `*.png` — screenshots at key player-facing checkpoints.
- `electron-user-data/` — isolated Electron user data for the run.

## Current Scenarios

`first_time_user` covers the current MVP release path:

1. Quick Start appears.
2. Tutorial Library opens.
3. A Dendry project is loaded through the player-facing Open Project action.
4. A World Event proposal is written through the Create UI.
5. The proposal is saved to My Changes.
6. The saved draft is sent to Review & Apply.
7. Desktop dry-run succeeds against the QA fixture.
8. Switching to a different valid project root through Open Project refuses the
   same plan with a `project_mismatch` diagnostic.

`explore_design_existing_edit` covers the next most important player journey:

1. Quick Start opens the project through the player-facing action.
2. Explore searches and selects an existing Event.
3. Design list view selects the same Event as a player-flow node.
4. Edit existing opens the Existing Scene Editor from Design.
5. A source-backed body line is changed and saved to My Changes.
6. Review & Apply loads an `existing_scene_edit` install plan.
7. Desktop dry-run proves the guarded `replace_text` operation would apply.

`draft_persistence_restart` covers returning to saved work:

1. Quick Start opens the project through the player-facing action.
2. A World Event proposal is written and saved to My Changes.
3. The Studio renderer is reloaded with the same Electron user data.
4. Open Project loads the same project again.
5. My Changes still lists the saved draft.
6. The saved draft reopens into Create.
7. Review & Apply loads the persisted install plan.
8. Desktop dry-run succeeds.

`load_bundled_demo_template` covers starting from nothing:

1. Quick Start offers the bundled Demo Template action.
2. The demo opens without a native folder picker.
3. Studio scans a writable app-data copy of the template.
4. Explore lists the demo event `A Small Campaign Office`.
5. The event inspector shows source-backed player text and demo variables.
6. The Variables view can find `demo_support`, the state changed by one option.

## Shortcuts

The runner uses a deterministic QA dialog shim for native folder selection.
Player-facing UI still clicks Quick Start or Open Project, then the shim returns
the configured fixture path to the same desktop preload, ProjectIndex builder,
viewer UI, install assistant, and guarded apply path as the app.

`draft_persistence_restart` also reloads the Studio renderer rather than
relaunching a packaged app process. That keeps the run deterministic while still
testing the persisted localStorage-backed My Changes data with isolated Electron
user data.

`load_bundled_demo_template` uses the packaged starter template and app-data
copy path directly. It proves the first-run Demo button can produce a writable
project, but it is still not a fresh package relaunch test.

Do not treat this MVP as full manual QA. It is a repeatable smoke path that
finds UI/runtime regressions before a human spends time on fresh package QA.

Scenario cards live in `qa/scenarios/`. Keep them written as player goals rather
than selector scripts so a human tester or subagent can follow the same journey.

## Useful Options

```bash
node tools/project_map/qa/run_desktop_scenario.js --list
node tools/project_map/qa/run_desktop_scenario.js --scenario first_time_user --headed
node tools/project_map/qa/run_desktop_scenario.js --artifact-dir /tmp/my-dms-qa
```

`--headed` shows the Electron window when a desktop session is available.
