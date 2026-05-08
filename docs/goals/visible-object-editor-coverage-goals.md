# Visible Object Editor Coverage Goals

This document defines two composite goals for raising Dendry Mod Studio's
player-facing object editing coverage. The goals are sequential: complete and
review Goal W before starting Goal X.

## Coverage Vocabulary

- Route coverage: every detected player-visible item has a clear destination in
  Studio, such as Visible Object Editor, System UI workspace, Variable
  workspace, Asset workspace, Review & Apply, or a manual boundary with a
  reason.
- Safe edit coverage: the item can be changed through Studio and converted into
  guarded install operations or exportable drafts without touching protected or
  generated output.
- Preview coverage: the item can be inspected in a view close enough to its
  player-facing surface to judge wording, card face, UI label, or object
  context before review.
- Structured logic coverage: conditions, routes, effects, scheduling, and
  variable references are represented as editable fields or explicit manual
  boundaries instead of disappearing into raw source text.

Route coverage should trend toward 100% in both goals. The 70% and 90% targets
refer to safe edit plus meaningful preview coverage for normal source-backed
content, not to unsafe automatic mutation of opaque scripts.

## Goal W: Visible Object Editor Coverage 70%

### Purpose

Make the current Visible Object Editor useful for most player-visible story and
card text without attempting to solve complex logic yet. A player should be able
to find a visible object, open it in a visual editor, edit the obvious fields,
preview the result, save a draft, and understand what will be safely applied or
left for manual review.

### Scope

- Existing world events and generic scene events.
- Existing cards, advisors, pinned cards, and card-like scenes.
- Existing news objects and monthly popup/news-like text where source evidence
  is available.
- Surface text only as a routed object that opens the correct text/System UI
  workspace, not as noise inside story Canvas.
- Review & Apply reporting for covered visible text operations.
- Coverage reporting for editable, manual-review, and unsupported items.

### TodoTasks

- Define a coverage report model for visible object editing that separates route
  coverage, safe edit coverage, preview coverage, and manual boundaries.
- Promote existing news extraction into a first-class visible object editing
  route when source evidence is stable.
- Ensure event/card/advisor editor fields cover title, heading, subtitle, body,
  conditional body, option labels, option subtitles, unavailable text, and card
  face text.
- Keep effects, custom JavaScript, generated output, protected routers, and
  unstable anchors visible as manual boundaries with source location and reason.
- Add or refine visual editor entry points from Storyboard Canvas, Card Board,
  Explore rows, and search results.
- Ensure the lightweight preview pane updates live when player-facing fields
  change.
- Ensure saved drafts reopen into the same object editor with changed fields
  preserved.
- Add model checks that measure starter-demo coverage and at least one fixture
  with news/card/event/manual-boundary cases.
- Add UI copy in English and Traditional Chinese for coverage labels, manual
  reasons, and editor route explanations.

### Non-Goals

- Do not auto-edit opaque JavaScript, generated runtime output, or protected
  router files.
- Do not make variables/effects a full graph editor yet.
- Do not merge System UI editing into Storyboard Canvas.
- Do not require full runtime preview to validate every edit.

### Acceptance Criteria

- Route coverage is effectively 100% for detected starter-demo visible text
  items: every item has an editor, workspace route, or manual boundary.
- Safe edit plus meaningful preview coverage reaches at least 70% for normal
  source-backed event/card/news visible fields in starter-demo and the selected
  parser fixture.
- Existing event and card objects can be opened from visual surfaces, edited in
  the floating editor, saved as drafts, reopened, and sent to Review & Apply.
- Existing news has a clear editor route or a documented manual boundary; it no
  longer feels like an accidental unsupported variant of event editing.
- Manual boundaries show the object, source path, reason, and suggested next
  action.
- UI remains bilingual for newly visible text.

### Final Test Procedure

- Run focused model checks for parser editability, edit capability, existing
  scene edit models, object authoring canvas, card board, and Review & Apply.
- Run localization surface check after visible text changes.
- Run starter-demo model check.
- Run the coverage report check introduced by this goal.
- Capture at least one Storyboard Canvas screenshot and one Card Board editor
  screenshot that show the floating visual editor and coverage/manual boundary
  behavior.
- Run `npm run check:ci` before commit when the goal is ready for acceptance.

## Goal X: Structured Logic And Variable Coverage 90%

### Purpose

Extend the 70% visible text editor into a semantic object editor that can handle
common Dendry logic and variable relationships. A player should be able to
understand why an object appears, where it routes, what it changes, and which
variables/UI surfaces consume it, without reading source code for ordinary
cases.

### Scope

- Event and card conditions such as view-if, choose-if, unavailable conditions,
  scheduling, frequency, max visits, priority, tags, and common route targets.
- Common effect patterns, especially simple quality/variable writes and option
  effects.
- Variable definitions: add, edit, initial/default values, labels, descriptions,
  type-like hints, and consumer lists.
- Variable consumers across events, cards, news, System UI/sidebar/qdisplay, and
  visible text conditions.
- System UI sidebar categories and rows as consumers/producers of variable
  display state.
- Review & Apply plans that distinguish structured safe edits from manual logic
  edits.

### TodoTasks

- Define a structured logic AST/field model for common condition and effect
  patterns, with a fallback manual boundary for unsupported expressions.
- Add route target editing for common option go-to patterns with validation
  against known scenes.
- Add variable creation and editing back into the Variable workspace with source
  anchors and guarded install planning.
- Add variable consumer indexing for events, cards, news, System UI/sidebar,
  qdisplays, and surface text.
- Connect variable consumers to the visible object editor sidebar so players can
  see what the selected object reads and writes.
- Add System UI editing for sidebar category count, category labels, visible
  rows, and row-linked variables.
- Add preview affordances for structured logic changes: selected object state,
  route/chain impact, variable read/write impact, and UI display impact.
- Add fixture coverage for complex conditions, simple effects, route edits, and
  variable/UI consumers.
- Expand coverage reporting to include structured logic coverage separately from
  plain text coverage.

### Non-Goals

- Do not promise safe automatic editing for arbitrary JavaScript expressions.
- Do not replace the real runtime preview; keep this as authoring preview and
  structured review.
- Do not support project-specific protected systems unless their profile marks a
  safe source layout.
- Do not optimize or transform assets.

### Acceptance Criteria

- Route coverage remains effectively 100% for detected visible objects,
  variables, and System UI rows.
- Safe edit plus meaningful preview coverage reaches at least 90% for common
  source-backed event/card/news/System UI/variable fields in starter-demo and
  the selected parser fixtures.
- Common conditions and simple effects are editable structurally or explicitly
  routed to manual review with source-backed reasons.
- Variable workspace supports creating and editing source-backed variables and
  shows consumer lists across story, cards, and UI.
- System UI workspace supports editing sidebar categories, category labels, and
  variable-backed display rows where source anchors are stable.
- Review & Apply clearly separates guarded structured edits from manual logic
  changes.
- Unsupported complex logic is not hidden; it is visible, explained, and
  searchable.

### Final Test Procedure

- Run all Goal W checks.
- Run variable editor, sidebar status, entry/sidebar, system UI screen, edit
  capability, parser editability, and studio contract fixture checks.
- Run `node tools/check_studio_contract.js --fixture-only` after parser,
  profile, router, protected-boundary, or variable-consumer changes.
- Capture screenshots for variable editor, System UI sidebar editing, and an
  event/card editor showing structured condition/effect context.
- Run `node tools/project_map/check_llm_friendliness.js` before and after the
  goal if large editor/parser files are touched.
- Run `npm run check:ci` before commit when the goal is ready for acceptance.

## Work Notes Area

Use this file as the persistent entry point for Goal W and Goal X notes. During
implementation, add short dated notes under this section or link to follow-up
documents in `docs/goals/` when a note becomes too large.

### Current Decision

- Goal W targets 70% safe edit plus preview coverage for visible object text and
  first-class news/card/event entry points.
- Goal X targets 90% coverage by adding structured logic, variable design, and
  System UI consumer editing.
- Manual boundaries count as route coverage, not safe edit coverage.

### Current Status

- Goal W is ready for user acceptance as a first measurable baseline. The core
  denominator, report model, Coverage Map row, focused check, linked legacy-news
  object route, and manual-boundary behavior are implemented.
- Goal X is ready for user acceptance as the 90% structured-coverage pass. It
  now includes variable consumer grouping, consumer evidence in the Variable
  Editor, structured logic coverage rows, guarded route-target edits, guarded
  simple Q effect edits, and System UI/sidebar/status checks.
- Goal X still keeps arbitrary JavaScript, protected routers, unstable source
  anchors, and project-specific UI/runtime systems as explicit manual
  boundaries. These are follow-up scope, not hidden coverage gaps.
- Accurate shorthand: Goal W baseline complete; Goal X 90% structured coverage
  complete and ready for review.

### 2026-05-07 Implementation Note

- Added `ProjectMapVisibleObjectCoverage`, a measurable coverage report model
  for visible object route coverage, safe edit coverage, preview coverage,
  manual boundaries, variable routes, and structured logic rows.
- Added `check_visible_object_coverage_model.js` and wired it into `check:ci`.
- Coverage Map now includes a Visible Object Editor row with route/safe/preview
  metrics so Goal W/Goal X coverage has a visible denominator in Studio.
- Legacy monthly popup news can expose the linked event object editor route;
  ticker/news-router content remains proposal-first/manual when source ownership
  is protected or unstable.
- Added `buildVariableConsumerModel` for variable read/write/definition
  consumers grouped by event, card, news router, System UI, or generic source.
- Variable Editor evidence now shows consumer summaries in addition to raw
  read/write refs.
- Structured logic rows are counted for conditions, metadata, routes, and simple
  Q effects.
- Existing option route targets are editable through line-scoped guarded
  replacements when the option line has stable source evidence; invalid route
  targets fall back to manual review.
- Existing simple Q effects are editable through guarded replacements when they
  match `Q.name = value`, `+=`, `-=`, `*=`, or `/=` patterns; complex or unsafe
  expressions fall back to manual review.
- Object Canvas exposes routes and option effects in the same preview editor
  logic panel used for conditions, so these fields no longer disappear into
  read-only context.
- Route/effect field construction lives in the focused
  `existing_scene_logic_fields.js` helper so `existing_scene_edit_model.js`
  stays below the LLM-friendliness warning threshold.

Focused checks run:

```bash
node tools/project_map/check_visible_object_coverage_model.js
node tools/project_map/check_variable_editor_model.js
node tools/project_map/check_existing_scene_edit_model.js
node tools/project_map/check_edit_capability_model.js
node tools/project_map/check_object_authoring_canvas_model.js
node tools/project_map/check_parser_editability_model.js
node tools/project_map/check_sidebar_status_model.js
node tools/project_map/check_entry_sidebar_model.js
node tools/project_map/check_system_ui_screen_model.js
node tools/check_studio_contract.js --fixture-only
node tools/project_map/check_studio_surface.js
node tools/project_map/check_localization_surface.js
```

Full checks also run:

```bash
npm run check:ci
node tools/project_map/check_llm_friendliness.js
```

Observed coverage on Starter Demo after this round:

```text
routeCoverage: 100%
Goal W safe edit coverage: 100%
Goal X safe edit coverage: 93.81%
unsupported: 0
```

The Goal X number is the current measurable acceptance signal for the agreed
90% phase. Manual boundaries remain visible for complex logic and protected
systems instead of being counted as safe edits.

### 2026-05-08 Handoff Memory

- Treat Goal X as functionally complete and ready for user review, not as a
  partially started foundation. The key acceptance signal is: Starter Demo route
  coverage 100%, Goal W safe edit coverage 100%, Goal X safe edit coverage
  93.81%, unsupported 0.
- The most important architectural decision from this pass is that route/effect
  structured logic must stay split out of the already busy existing-scene editor.
  `existing_scene_logic_fields.js` owns route-target and simple-Q-effect field
  construction plus guarded/manual fallback shaping.
- `existing_scene_edit_model.js` should remain a coordinator: resolve scene,
  collect visible text/metadata, ask the logic helper for structured fields, and
  build proposals. Avoid adding more parser domains directly to this file unless
  a smaller helper is not viable.
- Current safe structured logic scope is intentionally narrow:
  - route target edits require exact option-line source evidence and ID-shaped
    target names;
  - simple effect edits require single-expression `Q.name = value`, `+=`, `-=`,
    `*=`, or `/=` form;
  - invalid route targets, multi-statement effects, opaque JavaScript, protected
    routers, and unstable anchors must remain manual review.
- Object Canvas / preview object editor now has enough wiring to show routes and
  option effects alongside conditions. If future UI polish is needed, improve
  presentation there rather than moving these fields back into raw read-only
  context.
- Before the user accepts or asks for commit, re-run `npm run check:ci` and
  `node tools/project_map/check_llm_friendliness.js`; both passed after the
  split. The LLM-friendliness report still has existing large-file warnings, but
  this Goal did not add a new oversized warning after the helper extraction.
- Worktree is still broad and dirty from many prior Goals. Do not assume every
  modified file belongs to Goal X; inspect diffs carefully before committing.
