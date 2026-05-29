# Dendry Mod Studio Architecture

This is the canonical map of Studio's surfaces and module ownership. It answers
two questions:

- **For users (authors and modders):** "Which surface do I use for this task?"
- **For maintainers:** "Where does this responsibility live, and where should
  new code go?"

When code and this contract disagree, treat it as a bug in one of them and
reconcile — do not let a surface quietly grow a second job. Surface boundaries
that live only in people's heads drift; this file is where they are written
down and (via the governance triad below) enforced.

## The pipeline

Studio moves work through three stages. Most surfaces belong to exactly one:

1. **Inspect / understand** — see what the project already contains.
2. **Edit** — change or create content through structured, source-backed edits.
3. **Verify / apply** — review an install plan, preview at runtime, and write
   to the real project (desktop only).

## Cardinal editing rule

**Object Canvas is the only full detailed object editor.** Every other "edit"
path is either a focused editor for one narrow concern (Source Slice, Semantic
Logic, System UI) or a *context / navigation* surface that locates content and
opens Object Canvas (or Complex Event Builder for new archetypes).

Context surfaces — Explore, Design, Storyboard, Card Board — **must not** edit
content at all. They locate things and hand off to Object Canvas. If you find
yourself adding field inputs to one of them, the edit belongs in Object Canvas
with an entry point from the context surface.

## Surface responsibilities

### Inspect / understand

| Surface | Responsibility | Must not |
| --- | --- | --- |
| **Explore** | Browse the indexed project (Overview, Scenes, Events, Cards, News, Variables, Surface Text, Diagnostics, Coverage Map, Assets); row → inspector with source spans, confidence, edges; expose edit entry points. | Be a field editor; re-derive semantics (consume the model). |
| **Design** | Graph-first view of the same project by stable keys, with optional baseline compare and node-category filters; Inspector reuses Edit as Draft / Open in Explore. | Install source from Design; add a graph-layout library; re-derive route semantics. |
| **Storyboard** | Context / navigation for events, cards, routes, and story flow (LOD zoom, card stacking, lanes). | Edit content at all — no field editing; it only locates content and opens Object Canvas. |
| **Card Board** | Context / navigation for cards, decks, and advisor-like objects. | Edit content at all — no field editing; it only locates content and opens Object Canvas. |
| **Route Map** | Render normalized route / evidence / context data as understanding. | Re-derive Dendry route semantics in viewer code; introduce graph layout. |

### Edit

| Surface | Responsibility | Must not |
| --- | --- | --- |
| **Object Canvas** | THE detailed object editor: fields, preview, drafts, rendered entries, Copy as New, player-path choice layout, Review & Apply handoff. | — (this is where detailed editing lives). |
| **Complex Event Builder** | Create / edit supported event & card archetypes: root options, branches, conditions, route targets, effects, variable init, assets, with readiness gating. | Bypass the install-plan / Review & Apply path; re-derive route semantics. |
| **Source Slice / Advanced Source Patch** | Fallback editor for source-backed visible content the structured editors cannot map; still produces install operations. | Be a raw copy/paste flow; edit generated or protected output. |
| **Semantic Logic editor** | Edit routes, effects, variables, and conditions as parser-backed logic. | Edit arbitrary JS, protected routers, or dynamic keys — those stay guided / manual / runtime-observed. |
| **System UI editing** | Edit the player-facing *interface chrome* (title / top menu, sidebar status, election-results display, library-page frame), organized by the `entry_menu` / `library_page` / `in_game` player screens. | Edit story content in place — route it to Object Canvas (`open_content_scene`); treat generated / runtime output as directly editable — it stays observe-only (`runtime_review`) / manual. |

### Verify / apply

| Surface | Responsibility | Must not |
| --- | --- | --- |
| **Review & Apply** | Review install-plan operations; desktop bridge runs verified diff, dry-run, and apply for `safe`/`guarded`/confirmed `advanced` ops. | Apply `manual_review` / `refused` ops; write `out/html`, `out/game.json`, or `.git`. Browser mode is review-only. |
| **Runtime Preview** | Desktop-only baseline-vs-modified sandbox built from temporary copies. | Patch the real project folder. |
| **Runtime Lens** | Desktop focused observation of a playable path. | Claim to prove scheduler wiring; act as a full runtime debugger. |

## Module ownership and target shape

Each large subsystem should be a **thin orchestrator** (routing, state,
composition) plus **focused sibling modules** that each own one domain.

**Do it like these** (existing good splits):
`viewer/object_canvas_*`, `viewer/system_ui_*`, `viewer/storyboard_*`,
`authoring/existing_scene_*`, `authoring/route_*`, `authoring/event_structure_*`.

**The anti-pattern to stop:** new behavior gets added as siblings (good), but the
orchestrator keeps its original mass and only has its complexity-budget ceiling
raised (bad). Orchestrators must *shed* domain code, not merely spawn neighbors.

**Targets:**
- Prefer keeping JS modules under the budget warn line (1200 lines).
- An orchestrator that must stay larger needs an explicit, capped budget entry
  whose ceiling only ever falls (see the budget ratchet below).

## Convergence backlog (ordered)

Executed in later rounds against this contract. The first cut proves the loop;
each cut is pinned by existing `check_*.js` coverage and lowers the file's
budget number.

1. **`viewer/preview_object_editor.js` (~4970)** — safest first: CommonJS-exported,
   pinned by ~29 checks, internally already domain-grouped. Extract sibling
   renderers: asset editor (`renderAsset*` → `preview_asset_editor.js`),
   choice + route outcomes, effect + variable, card/news preview+editor.
2. **`viewer/object_authoring_canvas_ui.js` (~4734)** — BLOCKED: the whole file is
   a single closure (no top-level declarations). Convert shared closure state to
   explicit parameters first, then extract workspace modules.
3. **`authoring/existing_scene_edit_model.js` (~3281)**,
   **`authoring/event_structure_model.js` (~3346)**,
   **`authoring/object_canvas_content_adapters.js` (~2857)**,
   **`authoring/install_plan.js` (~2751)** — split by domain after the two viewer
   monsters.

**Removed:** the Spatial Canvas modules (`viewer/spatial_canvas_*`,
`authoring/spatial_canvas_*`) were superseded by Storyboard and have been deleted.
The storyboard view toggle offers Timeline and Chain only.

## Governance triad

These three together keep the contract honest. They land in the same round so
the contract is enforced rather than aspirational:

1. **This contract** — the destination (surface jobs + target module shape).
2. **One-way budget ratchet** — `check_source_complexity.js` lets a file's
   `maxLines` only fall; raising a ceiling is an explicit, reviewed exception,
   not routine. So growth must be paid for by a split.
3. **Manifest-driven `check:ci`** — the check list is data, readable and
   validated, instead of one ~95-item shell chain.

---

*Maintenance note:* keep this file in sync with the code. When a surface gains
or loses a responsibility, update its row here in the same change.
