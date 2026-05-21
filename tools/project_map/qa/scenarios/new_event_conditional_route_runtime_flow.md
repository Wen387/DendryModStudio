# Scenario: new_event_conditional_route_runtime_flow

Persona: A player-author wants proof that a newly created complex event is not
only a source file, but can be opened and played through its routes in Runtime
Preview.

Goal: Create a Conditional Menu / Loop event through the shared Object Canvas
draft pipeline, open the install-plan-created scene with Runtime Preview Focused
Entry, and click through root, section-owned, loop-return, and exit routes.

Required checkpoints:

- Starter Demo is copied to a writable temporary workspace.
- Object Canvas builds the conditional menu event through the shared EventDraft /
  EventStructure path.
- The Route Map contains a section-owned option route and editable condition
  handles.
- Runtime Preview creates a temporary sandbox without touching the real template
  source.
- Focused Entry opens `qa_conditional_menu_loop` in the modified runtime.
- QA ledger entries record `runtime_observed` evidence with entry mode,
  Focused Entry usage, scene id, observed scene id history when available,
  click path, and a filtered Q snapshot/diff.
- Clicking `Review the situation` reaches `Follow-up menu`.
- Clicking `Take the follow-up action` shows result text and returns to the menu.
- Clicking `Return to the opening question` returns to the root opening choice.

Allowed shortcut: the scenario uses Electron DOM automation against the
temporary Runtime Preview frame, but it clicks the same player-facing choices a
human would see.

Why this scenario matters: new Event parity is not complete until structured
creation, Route Map editing evidence, Review & Apply generation, Runtime
Preview Focused Entry, and playable complex routes all agree.
