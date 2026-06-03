# Dendry Mod Studio Guided UI QA

This directory contains guided UI QA scripts that run the real Studio viewer
inside Electron, interact with visible UI/DOM, take screenshots, and write a QA
ledger.

The runner is intentionally focused:

```bash
node tools/project_map/qa/run_desktop_scenario.js --scenario first_time_user
node tools/project_map/qa/run_desktop_scenario.js --scenario explore_design_existing_edit
node tools/project_map/qa/run_desktop_scenario.js --scenario desktop_mixed_apply_flow
node tools/project_map/qa/run_desktop_scenario.js --scenario content_storyboard_canvas_selection
node tools/project_map/qa/run_desktop_scenario.js --scenario draft_persistence_restart
node tools/project_map/qa/run_desktop_scenario.js --scenario load_bundled_demo_template
node tools/project_map/qa/run_desktop_scenario.js --scenario justice_party_template_mod
node tools/project_map/qa/run_desktop_scenario.js --scenario runtime_preview_entry_flow
node tools/project_map/qa/run_desktop_scenario.js --scenario dynamic_mod_smoke --dynamic-project-root /path/to/SDAAHdynamic
```

By default it writes artifacts under `/tmp/dendry_mod_studio_qa/<run-id>/`.
Each run contains:

- `QA_LEDGER.md` — scenario result, shortcuts, and step table.
- `transcript.json` — structured step log plus browser console messages.
- `*.png` — screenshots at key player-facing checkpoints.
- `electron-user-data/` — isolated Electron user data for the run.

## Current Scenarios

`first_time_user` covers the first-run release path:

1. Quick Start appears.
2. Tutorial Library opens.
3. A Dendry project is loaded through the player-facing Open Project action.
4. A World Event proposal is written through the Create UI.
5. The proposal is saved to My Changes.
6. The saved draft is sent to Review & Apply.
7. Desktop dry-run succeeds against the QA fixture.
8. Switching to a different valid project root through Open Project clears the
   stale install plan and disables dry-run, so a plan built for one project
   cannot be applied to another. The `project_mismatch` safety diagnostic
   itself is covered by `check_install_plan_model.js`.

`explore_design_existing_edit` covers the next most important player journey:

1. Quick Start opens the project through the player-facing action.
2. Explore searches and selects an existing Event.
3. Design list view selects the same Event as a player-flow node.
4. Edit existing opens the Existing Scene Editor from Design.
5. A source-backed page section is changed and saved to My Changes.
6. Review & Apply loads an `existing_scene_edit` install plan.
7. Desktop dry-run proves the guarded `replace_section` operation would apply.

`desktop_mixed_apply_flow` covers the highest-risk Review & Apply bridge path:

1. Quick Start opens a writable QA mini fixture copy.
2. Review & Apply loads a mixed install plan with create, replace, and copy
   operations.
3. Desktop dry-run runs through the preload IPC bridge without changing disk.
4. Apply writes the reviewed operations through the same bridge.
5. A follow-up dry-run reports the operations as already applied.
6. Disk checks confirm the created scene, text replacement, and copied asset.

`content_storyboard_canvas_selection` covers Canvas as an editing entry point:

1. Quick Start opens the project through the player-facing action.
2. Create opens the World Event / Content Storyboard Canvas.
3. The Storyboard renders a source-backed `event:*` card.
4. A mouse-like pointer click selects the card.
5. The visible object editor modal opens for the selected existing object.

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
4. Explore lists the demo event `Civic Reform Office Briefing`.
5. The event inspector shows source-backed player text and demo variables.
6. The Variables view can find `demo_support`, the state changed by one option.

`justice_party_template_mod` covers a fuller player-authored mod prototype:

1. Quick Start loads the bundled Demo Template as a writable project copy.
2. Explore inspects `Civic Reform Office Briefing` as the player's template example.
3. Entry & Sidebar changes the start menu, welcome text, status sidebar, and
   first playable route.
4. Create first event seeds the World Event Wizard from that first playable
   route.
5. Playable Surface customizes the starter party-affairs hand, deck, action
   card, and advisor text.
6. Workspace Layout adds a media deck lane, first media briefing card, and
   sidebar category from source-backed hand/status anchors.
7. Sidebar / Status edits an existing source-backed status category and adds a
   variable-backed conditional status line.
8. Card Wizard adds a routed party-affairs hand card and a routed labor advisor.
9. Create uses Variable candidates to insert `demo_support` into a condition
   and the effect helper.
10. The player drafts a Korean Justice Party campaign event and saves it.
11. The player drafts traditional monthly-popup style news as a World Event.
12. The player drafts Island-style ticker news through News Wizard.
13. Review & Apply dry-runs Entry & Sidebar, Playable Surface, Workspace
   Layout deck/card wiring, Sidebar / Status, routed card/advisor, and
   traditional event/news plans.
14. Review & Apply keeps the Island-style `post_event_news` operation guarded or
   manual-review when the template lacks a matching Island news router.

`runtime_preview_entry_flow` covers the in-app game preview path:

1. A writable Starter Demo copy is prepared.
2. Desktop Runtime Preview builds baseline and modified sandboxes.
3. The modified game preview opens in Electron.
4. Automation clicks the root start option.
5. Automation clicks a player choice on an advisor-like card in the hand
   workspace.
6. The preview shows changed sidebar/status text after the choice.

`dynamic_mod_smoke` covers a real SDAAH Dynamic checkout:

1. Quick Start opens Dynamic through the player-facing Open Project action.
2. Explore finds and opens an existing source-backed event in Object Canvas.
3. The existing edit saves and reviews as `existing_scene_edit`.
4. A small Dynamic-style World Event proposal renders and dry-runs.
5. A Dynamic-tagged Card proposal renders and dry-runs.
6. The Card dry-run confirms project-specific `source/scenes/*/` card folders
   are not refused as unsafe paths.

## Shortcuts

The runner uses a deterministic test dialog adapter for native folder
selection.
Player-facing UI still clicks Quick Start or Open Project, then the adapter
returns the configured fixture path to the same desktop preload, ProjectIndex
builder, viewer UI, install assistant, and guarded apply path as the app.

`draft_persistence_restart` also reloads the Studio renderer rather than
relaunching a packaged app process. That keeps the run deterministic while still
testing the persisted localStorage-backed My Changes data with isolated Electron
user data.

`content_storyboard_canvas_selection` dispatches mouse-like pointer events
inside Electron. It is still testing the real Canvas pointer handler; the
shortcut only replaces manual hand movement.

`desktop_mixed_apply_flow` writes under the system temp directory, in
`dms-playtests/desktop-mixed-apply-flow/`, and deliberately mixes create,
replace, and local asset copy operations to exercise the real desktop dry-run,
apply, and post-apply verification path.

`load_bundled_demo_template` uses the packaged starter template and app-data
copy path directly. It proves the first-run Demo button can produce a writable
project, but it is still not a fresh package relaunch test.

`justice_party_template_mod` also writes its default artifacts under the system
temp directory, in `dms-playtests/justice-party-template-mod/`, so the temporary
project copy, screenshots, and ledger can be inspected without entering git.

`runtime_preview_entry_flow` writes under the system temp directory, in
`dms-playtests/runtime-preview-entry-flow/`, and uses the packaged Starter Demo
plus Electron DOM automation to check the real generated game UI.

`dynamic_mod_smoke` writes under the system temp directory, in
`dms-playtests/dynamic-mod-smoke/`.
It expects a local Dynamic checkout, passed with `--dynamic-project-root` or
`DMS_DYNAMIC_FIXTURE_ROOT`. The scenario can take longer than mini-fixture runs
because Dynamic has hundreds of scenes and thousands of variables.
This is a real-project pressure smoke, not a generic compatibility proof:
generic routing, preview, and install-safety invariants should be covered by the
model checks and `check_dynamic_mod_audit.js` comparison table, while specific
objects such as Dynamic events or card folders are only sample coverage for the
SDAAH-style profile.

Do not treat these runs as full manual QA. They are repeatable smoke paths that
find UI/runtime regressions before a human spends time on fresh package QA.

Scenario cards live in `qa/scenarios/`. Keep them written as player goals rather
than selector scripts so a human tester or automation runner can follow the same
journey.

## Useful Options

```bash
node tools/project_map/qa/run_desktop_scenario.js --list
node tools/project_map/qa/run_desktop_scenario.js --scenario first_time_user --headed
node tools/project_map/qa/run_desktop_scenario.js --scenario desktop_mixed_apply_flow --timeout-ms 60000
node tools/project_map/qa/run_desktop_scenario.js --scenario justice_party_template_mod --headed --step-delay-ms 1200
node tools/project_map/qa/run_desktop_scenario.js --scenario dynamic_mod_smoke --dynamic-project-root /path/to/SDAAHdynamic --timeout-ms 90000
node tools/project_map/qa/run_desktop_scenario.js --artifact-dir /tmp/my-dms-qa
```

`--headed` shows the Electron window when a desktop session is available.
