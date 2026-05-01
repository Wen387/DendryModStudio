# Scenario: draft_persistence_restart

Persona: returning mod author who saved work and came back later.

Goal: create a proposal, save it to My Changes, reload Studio, reopen the same
project, confirm the saved draft is still present, open it, and dry-run its
install plan.

Required checkpoints:

- Quick Start opens the project through the player-facing Open Project action.
- A World Event draft named `QA persistent event` is created.
- My Changes saves the draft before leaving.
- The Studio renderer is reloaded with the same Electron user data.
- Quick Start stays dismissed after reload.
- Open Project can reload the same fixture project.
- My Changes still lists `QA persistent event`.
- Opening the saved draft restores the Create form.
- Review & Apply loads the persisted `qa_persistent_event` install plan.
- Dry-run returns installable `would_apply` operations.

Allowed shortcut: the native folder picker is replaced by the deterministic QA
dialog shim. The scenario reloads the Studio renderer instead of relaunching a
packaged app process.
