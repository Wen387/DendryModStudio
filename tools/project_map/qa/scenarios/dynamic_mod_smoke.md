# Scenario: dynamic_mod_smoke

Persona: A player is testing Studio against a real SDAAH Dynamic checkout and
wants to know whether the editor can survive real project scale rather than only
the bundled mini fixtures.

Goal: Open Dynamic, inspect and edit an existing event, create a small event,
create a Dynamic-tagged card, and confirm Review & Apply dry-runs the plans
without turning existing edits into new files or refusing Dynamic card paths.

Required checkpoints:

- Quick Start opens the local Dynamic project through the normal Open Project
  path.
- Explore finds `All Quiet on the Western Front` and opens the unified Object
  Canvas for existing editing.
- The existing edit reviews as `existing_scene_edit` and dry-runs a guarded
  source-backed operation.
- A new World Event proposal renders and dry-runs.
- A Dynamic `party_affairs` Card proposal renders and dry-runs a
  `source/scenes/*/` create path without `unsafe_path`.
- Screenshots capture the existing editor, new event proposal, card proposal,
  and review/dry-run surfaces.

Allowed shortcut: the scenario uses the deterministic test dialog adapter for
the local Dynamic checkout and DOM automation for repeatability. It still uses
the real Studio renderer, Review & Apply model, and desktop dry-run path.

Why this scenario matters: Dynamic has hundreds of monthly popups, thousands of
variables, and project-specific card folders. This scenario catches failures
that the small starter fixtures cannot represent.
