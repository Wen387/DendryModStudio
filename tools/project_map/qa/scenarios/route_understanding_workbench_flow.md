# Scenario: route_understanding_workbench_flow

Persona: A mod author is inspecting a complex election-style event and wants
Studio to explain the route context before making any source edits.

Goal: Render a minimized complex route fixture through the same browser-loaded
Route Map UI and verify the read-only context chips for event chain, scheduler,
utility call/return, and manual JS state dependency.

Required checkpoints:

- Studio renderer loads the browser-safe authoring models.
- The fixture declares a five-stage presidential-election-like event chain.
- The scheduler context shows a protected `#event` deck route.
- `go-to: election_algorithm` plus `set-jump: pres_election` appears as a
  guided utility call/return, not a safe inline rewrite.
- The utility scene's `jumpScene` return binding is not reported as a missing
  target.
- Opaque vote-calculation JS appears as a manual state dependency.

Allowed shortcut: the scenario uses a synthetic public fixture inside the
renderer instead of copying local DynamicRepo content. It verifies the real
browser-loaded model and Route Map renderer, not private source prose.

Why this scenario matters: complex Dendry projects often route through
schedulers, utility scenes, and route-affecting state. Studio should make that
context visible without pretending that arbitrary JS or protected routers are
safe structured edits.
