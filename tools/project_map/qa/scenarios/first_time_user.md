# Scenario: first_time_user

Persona: first-time Studio tester.

Goal: open Studio, read the first-run guidance, create a small Event proposal,
save it, review it, dry-run it, then confirm switching to a different project
clears the stale plan so it cannot be applied to an unrelated project.

Required checkpoints:

- Quick Start is visible on first launch.
- Tutorial Library opens from Quick Start.
- Open Project loads the QA fixture through the test dialog adapter.
- Create produces a World Event install plan.
- My Changes stores the draft and can send it to Review & Apply.
- Dry-run returns installable `would_apply` operations.
- Switching to a different project clears the stale install plan and disables
  dry-run, so a plan built for one project cannot be applied to another. The
  `install_plan.project_mismatch` safety diagnostic itself is covered by
  `check_install_plan_model.js`.

Allowed shortcut: the native folder picker is replaced by the deterministic
test dialog adapter. The player-facing Open Project action must still be
clicked.
