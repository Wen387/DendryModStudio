# Scenario: load_bundled_demo_template

Persona: first-time mod author who does not have a real project ready yet.

Goal: use Quick Start to load the bundled demo template, then inspect how a
small in-game event maps to Studio concepts.

Required checkpoints:

- Quick Start exposes a bundled Demo Template action.
- The demo opens without using a native folder picker.
- The opened project is a writable copy under Electron app data, not the
  packaged template source.
- Explore lists `A Small Campaign Office` as an event-like player-facing scene.
- The event inspector shows source-backed text and demo variables.
- The Variables view can find `demo_support`, the state changed by one option.

Allowed shortcut: the scenario uses the packaged starter template and app-data
copy path directly. It does not test a fresh package relaunch or real user file
picker selection.
