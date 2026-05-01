# Scenario: first_time_user

Persona: first-time Studio tester.

Goal: open Studio, read the first-run guidance, create a small Event proposal,
save it, review it, dry-run it, then confirm the same plan refuses a different
project.

Required checkpoints:

- Quick Start is visible on first launch.
- Tutorial Library opens from Quick Start.
- Open Project loads the QA fixture through the QA dialog shim.
- Create produces a World Event install plan.
- My Changes stores the draft and can send it to Review & Apply.
- Dry-run returns installable `would_apply` operations.
- Opening a different project makes the same plan report
  `install_plan.project_mismatch`.

Allowed shortcut: the native folder picker is replaced by the deterministic QA
dialog shim. The player-facing Open Project action must still be clicked.
