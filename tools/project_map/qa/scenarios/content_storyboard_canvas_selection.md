# Scenario: content_storyboard_canvas_selection

Persona: mod author using Canvas as the main story editing entry point.

Goal: open Create, use the Content Storyboard Canvas, click an existing
source-backed Event card directly on the board, and confirm it becomes selected
and opens the focused visible object editor.

Required checkpoints:

- Quick Start opens the project through the player-facing Open Project action.
- Create opens the World Event / Content Storyboard Canvas.
- The Canvas renders at least one source-backed `event:*` Storyboard card.
- A mouse-like pointer click on the card selects that card.
- The selected card opens the visible object editor modal.
- The active authoring template is `existing`, proving the click opened the
  source-backed object instead of only moving or panning the board.

Allowed shortcut: the native folder picker is replaced by the deterministic
test dialog adapter. The click itself is sent as mouse-like Electron pointer
events so the run exercises the same Canvas pointer handler a user click uses.
