# Scenario: runtime_preview_entry_flow

Persona: A player wants proof that Studio's built-in game preview is not just
building files, but actually lets them enter the first playable route and see
state change after a choice.

Goal: Start from the bundled demo, open a Runtime Preview sandbox, click from
the start menu into the first playable workspace, use an advisor-like card, and
confirm the sidebar/status display updates.

Required checkpoints:

- Starter Demo is copied to a writable temporary workspace.
- Runtime Preview creates baseline and modified sandboxes without touching the
  real template source.
- The modified game preview shows the Entry & Sidebar edited root start option.
- Clicking the start option enters `Workspace Hand`.
- Clicking `Review starter advisor` and `Ask for organizing help` advances to
  result text.
- The sidebar/status surface shows `Runtime preview support is visible` after the
  choice changes `demo_support`.

Allowed shortcut: the scenario uses Electron DOM automation for the generated
game preview instead of a human mouse, but it clicks the same player-facing
links in the same Runtime Preview output.

Why this scenario matters: release testing needs to know that Entry/Sidebar,
hand/advisor routes, and sidebar state changes are visible in the actual
generated game, not only in Studio draft JSON or patch previews.
