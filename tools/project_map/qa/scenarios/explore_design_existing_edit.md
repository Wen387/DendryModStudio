# Scenario: explore_design_existing_edit

Persona: cautious mod author editing existing player-facing text.

Goal: find an existing Event the way a player-tester would, understand it in
Design, open contextual Editing, inspect graph-like flow/source context, change
a source-backed page section, save the proposal, and dry-run the guarded
replacement.

Required checkpoints:

- Quick Start opens the project through the player-facing Open Project action.
- Explore Events search can find and select `Generic Intro`.
- The Explore inspector exposes Edit existing for that event.
- Design list view can find the same event as `event:generic_intro`.
- The Design inspector exposes Edit existing.
- Contextual Editing opens in Create with a graph-like context surface for the
  selected scene.
- The workspace updates the proposal preview when a source-backed page section
  changes.
- My Changes saves the existing edit.
- Review & Apply loads an `existing_scene_edit` plan.
- Dry-run returns a guarded `replace_section` operation with `would_apply`.

Allowed shortcut: the native folder picker is replaced by the deterministic
test dialog adapter. The player-facing Open Project action must still be
clicked.
