# DendryNexus Field Notes For Studio Contributors

These notes collect practical lessons from SD:AAH-style modding, community
creator experience, and Dendry Mod Studio parser work. They are not a complete
DendryNexus specification. Treat them as a living field guide: when a real
project contradicts an assumption, verify it against the engine parser and
update the Studio checks.

## Why This Exists

Dendry Mod Studio tries to make existing Dendry/DendryNexus projects inspectable
and editable without pretending every source file is simple. The hard part is
that real projects mix content, runtime JavaScript, custom HTML/CSS, cards,
hands, decks, sidebar scenes, monthly routers, and generated output. Studio must
therefore preserve author intent, surface reliable edit actions, and refuse or
defer work when the source evidence is not strong enough.

Community guides are useful because they describe how creators actually think
about these files. Studio should compare that working knowledge with the parser,
not replace it with a tidy but false model.

## Sources Of Truth

Use these in order when deciding whether Studio should parse or edit something:

1. The DendryNexus parser and runtime behavior.
2. Real project source that builds and runs, especially SD:AAH-style projects.
3. Studio ProjectIndex evidence and repeatable checks.
4. Community field reports, used as clues to investigate the first three.

Community examples may contain Discord formatting artifacts. For example, a
message can visually hide or transform leading hyphens. Do not add Studio syntax
support solely because a pasted guide appears to show an option without `-`.
Confirm it against the parser or a working project first.

## Cross-checking A New Lesson

Before turning a surprising source pattern into a Studio rule, compare at least
two kinds of evidence:

- Source evidence: the `.dry` file pattern and its surrounding project context.
- Parser evidence: Studio's parsed ProjectIndex and, when possible, the
  DendryNexus parser source.
- Build evidence: `dendrynexus make-html` output, especially `out/game.json`,
  which shows final scene ids, qualified section ids, tags, and directives.
- Runtime evidence: a bounded `random-test` or Runtime Preview path when the
  behavior is about play flow rather than static compilation.

Good field notes survive this comparison. Weak notes usually fail because a
pattern is just a tutorial shortcut, a generated-output artifact, or a single
project's custom runtime behavior.

When using `random-test`, remember that hub/card examples can intentionally
loop. Use bounded runs, dumps, or a timeout, and keep only the route evidence
needed for the lesson.

## Mental Model

A DendryNexus project is not just a tree of prose scenes.

- `source/` contains the main game content and most author-editable intent.
- `out/html/` contains runtime display code, CSS, JavaScript, and generated or
  customized browser assets. Studio can use it as preview/runtime evidence, but
  source-backed edits should map back to `source/` when possible.
- `out/game.json` and generated runtime files are build outputs. They are useful
  for diagnostics but should not become the primary edit target.
- `package.json` can point at a specific DendryNexus engine fork. That means
  parser/runtime behavior can vary by project.

Studio should ask: "Where did this visible behavior come from?" before offering
an edit.

## Common Scene Directives

Creators commonly use these scene-level directives:

```text
Title
Subtitle
View-if
Choose-if
unavailableSubtitle
Go-to
Tags
New-page
Is-card
Is-special
Face-image
Card-image
Is-hand
Is-deck
Max-cards
Audio
Audio: shuffle audio/theme.ogg
Achievement
Call
On-arrival
On-departure
On-display
```

Studio should not assume that project authors write every directive in one exact
spelling. The parser accepts common variants that normalize to the same property
shape. In practice, Studio should treat these as equivalent when indexing source
evidence:

```dry
Title: Center Party
title: Center Party

Face-image: img/portraits/AufhauserSiegfried.jpg
face-image: img/portraits/AufhauserSiegfried.jpg
faceImage: img/portraits/AufhauserSiegfried.jpg

Set-bg: img/backgrounds/congress.jpg
set-bg: img/backgrounds/congress.jpg
setBg: img/backgrounds/congress.jpg

unavailableSubtitle: Our relations are not good enough.
unavailable-subtitle: Our relations are not good enough.
```

The practical rule is: parse like the engine where possible, display a stable
normalized name in Studio, and preserve the original source span when applying
edits.

## Scene Shape

A typical single-scene file can look like this. If the file is named
`center_party_conference.scene.dry`, the top-level scene id comes from the
filename; the `@support_joos` and `@support_aufhauser` blocks are sections
whose compiled ids become `center_party_conference.support_joos` and
`center_party_conference.support_aufhauser`.

```dry
Title: Center Party / CVP Conference
Face-image: img/portraits/AufhauserSiegfried.jpg

= Center Party

The party holds a conference to choose its next chair.

- @support_joos: Support Joos
- choose-if: z_relations >= 2
- unavailableSubtitle: Our relations are not good enough.
- @support_aufhauser: Support Aufhauser

@support_joos
Title: Support Joos

Joseph Joos remains the consensus candidate.

@support_aufhauser
Title: Support Aufhauser

Aufhauser offers a different path.
```

Important Studio assumptions:

- A top-level `<id>.scene.dry` file gets its scene id from the filename. In
  that case the id has no editable source line.
- Lines beginning with `@` define sections inside that file. The engine
  qualifies them as `parent.section`, so a section can behave like a scene even
  though its id is not an independent top-level filename id.
- Options should be parser-valid options, normally beginning with `-`.
- Do not put blank lines inside a single option block. In Dendry's parser, a
  blank line after options ends the option block; another `- @target` after
  that is invalid content.
- Generated option/router inserts must follow the same rule when they are
  added inside an existing option block. Insert content such as
  `- #event: Monthly event popups` should stay contiguous with neighboring
  option lines and should not include padding blank lines that split the block.
- A line such as `@another_scene: Visible option text` in a community note may
  be missing the leading option marker because of chat formatting. Confirm
  before accepting it as syntax.
- Option metadata lines after an option also need the leading `-`, such as
  `- choose-if: ...` or `- unavailableSubtitle: ...`.
- `---` is not required for normal scenes and should not be inserted unless the
  project's parser style actually requires it.
- `= Heading` is visible body structure, not a directive.
- Metadata directives such as `face-image` and `unavailable-subtitle` must
  appear before the body text of the scene or section they belong to. If a
  directive-looking line appears after prose has begun, Dendry treats it as
  rendered text rather than metadata.

## Main Scene Categories

SD:AAH-style projects often organize content by role rather than by a strict
engine schema.

- `Root` initializes variables and owns the main menu / difficulty entry path.
- `Main` is usually the hand scene. It can contain decks, drawn cards, pinned
  choices, advisor panels, and easy/normal variants.
- `Post_event` is often the monthly tick, event router, normalizer, and event
  popup dispatcher.
- `Status` is commonly a sidebar or information surface.
- `Game_over` may contain endings and achievement-related paths.
- Folder names such as `events`, `party_affairs`, `government_affairs`, and
  `advisors` describe creator workflow more than engine-enforced categories.

Studio should infer roles from directives, graph evidence, tags, and profile
rules rather than from folder names alone.

## Cards, Hands, And Decks

Common directives:

```dry
@main
Is-hand: true
Max-cards: 4

@party_affairs
Is-deck: true
Tags: party_affairs

@campaigning
Is-card: true
Tags: party_affairs
```

Deck-like content can also be embedded as a section inside a hand scene:

```dry
title: hand
is-hand: true
max-cards: 3

- @deck1

@deck1
title: Deck1
is-deck: true

- #deck1
```

Lessons for Studio:

- `is-hand`, `is-deck`, and `is-card` are structural evidence, not just labels.
- `max-cards` should be retained in ProjectIndex as part of hand behavior.
- Tags can drive deck membership and bulk option routing.
- Hand scene deck/card/advisor display still uses ordinary choice filtering,
  including priority. If one always-visible pinned/control choice has a higher
  `priority` than the deck or advisor choices, DendryNexus can render only that
  highest-priority group and hide the rest of the hand surface.
- A deck may be a section-owned anchor such as `hand.deck1`, not only an
  independent top-level scene. In build output, DendryNexus fully qualifies
  that section id and keeps `isDeck: true` on the section scene.
- Authoring and install-plan rules that wire a new card into a deck should use
  the section's own option/source anchors when the deck is section-owned.
- Pinned or always-visible choices may behave like UI controls even when they
  are written as normal scene options.

Do not assume every card-like object has an image, every deck is in a deck
folder, or every scene in a card folder is selectable.

## Hooks And Script Blocks

Common hooks:

```dry
On-arrival: month_actions += 1
On-departure: z_relations -= 1
On-display: {! Q.preview_seen = true; !}
```

Engine-facing lessons:

- `on-arrival` runs when entering a scene.
- A scene can pair `on-arrival` state writes with immediate route directives.
  Route analysis should treat those writes as possible pre-route state changes
  instead of evaluating the `go-to` predicates in isolation.
- `on-departure` runs when leaving a scene and can be gameplay-significant.
- `on-display` runs after the scene text is rendered but before immediate
  `go-to` / `go-to-ref` resolution and choice compilation. It can therefore
  affect route predicates and choice availability, but it has already occurred
  after the current scene content was displayed.
- Hook values may be shorthand expressions or `{! ... !}` JavaScript blocks.

Studio lessons:

- Index variable reads/writes from all real hooks, including `on-departure`.
- Do not auto-apply departure logic during an arrival-only preview simulation.
- Treat opaque JavaScript as evidence to display and reason about, not as a
  promise that Studio can safely rewrite it.
- When removing or editing an effect, preserve hook boundaries and refuse
  source changes when the source span is ambiguous.

## Conditions

Common condition directives:

```dry
View-if: z_party_name == "CVP"
Choose-if: z_relations >= 2
Go-to: @center_party_conference
```

Inline conditional text can also appear inside ordinary prose:

```dry
We improved relations[? if in_grand_coalition:, and reduced coalition tensions?].
```

Treat this as a conditional fragment inside one paragraph. The paragraph is
still a normal source-backed text block, but the condition and conditional text
should remain inspectable. Do not promote the fragment into a standalone branch,
and do not render the conditional fragment as if it were unconditional prose.

Studio should accept common spelling and casing variants when indexing:

```text
view-if
View-if
viewIf
view if
choose-if
Choose-if
chooseIf
choose if
go-to
Go-to
goTo
```

However, edit output should follow the surrounding file style when possible.
If no local style is clear, prefer common Dendry kebab-case directive names.

## Routes And Dynamic References

Not every route-like directive names a static scene.

```dry
go-to: next_scene
go-to: success if public_order > 0; failure
go-to-ref: stored_scene_id if route_ready; fallback_scene_id
go-sub: shared_intro
set-jump: return_from_algorithm
```

Dendry `go-to:` lines can be semicolon-separated route lists, not just single
edges. Each clause is a route entry with its own target and optional condition:

```dry
@results
go-to: left if reform_wins; right if reform_loses; compromise if reform_ties
```

Important lessons:

- Preserve sibling clauses and source order when editing one branch, but do not
  treat order as if/else priority. The DendryNexus runtime gathers all route
  clauses whose predicates are true; if more than one target is valid, it
  chooses randomly among them. A mixed line such as
  `go-to: main_rally; sa_disrupt if sa_force > 25` can therefore be a random
  split when the condition is true, not a fallback chain.
- A trailing unconditional clause is always valid. It is not an ordered
  fallback. To express fallback behavior, route predicates must be mutually
  exclusive, such as `a if flag = 1; b if flag != 1`, or the author must first
  compute one route code and route through mutually exclusive cases.
- A local section such as `@right` may be reached only through one clause in a
  multi-clause `go-to:` line. That still makes it a referenced layer.
- Removing or retargeting that layer should update only the matching clause
  when source evidence is exact. Deleting the whole `go-to:` line would silently
  remove unrelated branches.
- Match source-local targets such as `right` against compiled qualified ids such
  as `event_id.right`; both describe the same section at different layers.
- When an index has a line number and source excerpt but no clean anchor text,
  recover the exact directive line from the excerpt before treating the route as
  editable evidence.
- In section-like option result blocks, keep `go-to:` before the result prose.
  Runtime Preview verified that placing `go-to:` after prose can compile as
  visible paragraph text instead of a route.
- For generated single-file event drafts, an authoring route target named
  `root` means the event opening node. Render it as the generated scene id;
  literal `go-to: root` jumps to the project's global root scene.

Studio lessons:

- `go-to` and option targets can usually be resolved against scene ids and
  local section anchors.
- Resolve route ids from parser/compiler facts instead of guessing from raw
  strings. Bare local names, section-qualified ids, absolute/global ids, and
  project conventions such as `root` can shadow one another. If Studio cannot
  prove which compiled scene id a token names, show ambiguous route evidence
  rather than silently choosing a target.
- `go-to-ref` points at a quality whose runtime value is a scene id. Index it
  as dynamic route evidence, not as a missing static scene target.
- Multiple valid `go-to-ref` entries follow the same multi-valid behavior as
  `go-to`: one valid ref jumps through that quality value, while multiple valid
  refs are randomly selected before dereferencing the chosen quality.
- Direct `go-to` bypasses normal choice compilation and does not use target
  `view-if` as a filter. Choice compilation filters option visibility using the
  option `view-if` and target scene `view-if`, then determines clickability from
  option `choose-if` and target scene `choose-if`.
- Chained or conditional routes preserve source order for editing, and should
  also expose possible multi-valid randomization when predicates can overlap.
  They can be parser-backed while still requiring manual review before source
  rewrites.
- Route collision checks should distinguish direct pre-route writes to
  predicate dependencies from opaque script-before-route blocks, because the
  former can be simulated by a bounded safe evaluator while the latter remains
  evidence for manual review.
- Collision checks should also surface zero-valid samples. A conditional route
  group can have no valid target for some state combinations, which is a
  routing coverage gap rather than a normal fallback.
- `go-sub`, `go-sub-start`, and `go-sub-end` are parser-backed subroutine-like
  navigation. Treat them as real behavior, but keep automated edits
  conservative because runtime handling is more nuanced than ordinary `go-to`.
- `set-jump` records a runtime jump/return target used by subroutine-like flows
  such as election algorithms. Show it as route evidence, but do not present it
  as a normal immediate `go-to`. Treat it as a single-slot return target rather
  than a call stack; nested jump patterns should remain advanced/manual unless
  runtime/profile evidence proves the intended behavior.

When a route field is dynamic, the useful Studio output is often "this scene
depends on a runtime value" rather than "this target is broken."

Dynamic route support should be tiered:

- Safe structured edit: parser/compiler-backed routes whose target exists,
  predicates are known to be mutually exclusive, and relevant pre-route effects
  are limited to static assignments Studio can evaluate conservatively.
- Guided advanced edit: finite route tables, literal route-quality writes,
  ternary or object-map route assignments, `set-jump` metadata, or
  profile-declared helper functions where a project adapter can name the
  candidate target set and protected boundaries.
- Runtime-observed evidence: repeatable preview or smoke-test paths that record
  the engine/build version, seed, entry mode, Q-state snapshot or diff, click
  path, and observed scene ids. This can explain behavior and catch regressions,
  but it should not be relabeled as exact static proof.
- Manual boundary: opaque JavaScript, dynamic keys, loops over state,
  randomness, external helper calls without profile evidence, protected system
  routers, missing/external targets, and overlapping route predicates that can
  intentionally randomize.

This tiering lets the Route Map show more dynamic behavior without implying
that every dynamic route is safely editable inline.

## Checks And Runtime Display Fields

Some DendryNexus forks and examples use Fallen London-style checks and richer
runtime display directives:

```dry
check-quality: public_order
broad-difficulty: 60
difficulty-scaler: 0.5
check-success-go-to: success
check-failure-go-to: failure
set-sprites: topLeft: img/events/sprite.png
set-music: audio/theme.mp3
set-top-left-style: "width: 120px"
```

Studio should preserve these fields as source-backed evidence. That does not
mean every field is immediately safe to edit. In particular, stat-check routing,
sprite layout, and custom runtime rows can depend on project-specific engine
forks or HTML templates.

## Images And Assets

Community creators usually think of image directives in simple terms:

- `face-image` is the image shown in a scene.
- `card-image` is the image shown on a card.
- `set-bg` / `setBg` can change a runtime background.
- `set-sprites` can reference one or more positioned images.
- `set-music` and `audio` can reference music or sound, sometimes more than
  one file in the same directive.

Studio must distinguish three different facts:

1. A source directive references an asset path.
2. The referenced file exists in the project.
3. The runtime actually renders it in the current preview surface.

All three matter, and they can disagree. For example, a source scene can contain
`face-image: img/portraits/AufhauserSiegfried.jpg`, the file can exist, and a
custom runtime layout can still fail to display it.

One stock DendryNexus browser-runtime mismatch is worth checking explicitly:
the engine creates scene portrait elements with class `.face-img`, while some
generated CSS templates style `.face-image`. In that case the directive and file
are correct, but the runtime image appears incorrectly styled. Studio Runtime
Preview should patch or diagnose that generated HTML/CSS compatibility layer
rather than blaming the source asset.

Asset edit rules:

- Index directive variants such as `face-image`, `faceImage`, `card-image`,
  `cardImage`, `set-bg`, `setBg`, `set-sprites`, `set-music`, and `audio`.
- Keep the original relative path visible to the author.
- Offer copy/repair proposals only when the destination and source file evidence
  are clear.
- Do not treat a text mention such as `Great. face-image: ...` inside body prose
  as an actual directive unless it is parsed from directive position.
- A directive-looking line can also be inert when it starts at the beginning of
  a body line. For example, a `face-image:` line placed after a paragraph inside
  `@kaas` will render as text and will not populate that section's `faceImage`.
- Runtime Preview is evidence, not proof of source correctness. If an image
  reference is indexed but absent at runtime, inspect runtime rendering code,
  generated output, and the active scene template.

## The Post-event Boundary

`post_event`-style scenes are often giant tick routers. They may normalize
variables, advance time, preload images, create monthly event choices, inject a
placeholder Continue option, and route back to the hand.

Studio should be conservative here:

- It can index variables, text, routes, and event evidence.
- It can use profile-aware anchors for known router layouts.
- It should not pretend arbitrary router JavaScript is safely editable.
- It should report manual review when event insertion, dedupe, or source span
  evidence is weak.
- Profile adapters should mark central scheduler/router scenes as protected
  system boundaries instead of folding project-specific scheduling rules into
  the generic Dendry parser. The editor should consume parser/compiler facts
  plus profile evidence; it should not hard-code one project's scheduler into
  Dendry core behavior.

The goal is not to make `post_event` invisible. The goal is to avoid offering a
button that looks safe while making a hidden monthly-router bug.

Runtime observations are useful evidence, but they are not static proof. A
ledger should record at least the engine/build version, seed, entry mode
(`goToScene`/Focused Entry versus normal player path), Q-state snapshot or diff,
click path, and observed scene ids. Focused Entry can prove a scene path is
playable, but it may bypass normal scheduler, migration, view-if, visit-count,
deck priority/frequency, or saved-state behavior.

## Runtime HTML Is Real, But Not The Main Edit Target

SD:AAH-style projects can customize `out/html` heavily. That means bugs may live
outside `source/`, including:

- missing runtime scripts,
- custom rendering functions,
- CSS that hides or overlays content,
- image preload/display code,
- save/load or option menu modifications,
- sidebar/status display code.

Studio should inspect runtime HTML when diagnosing preview behavior. But for
authoring, it should prefer source-backed edits unless the requested change is
explicitly a runtime surface change.

## Studio Parser Principles

When extending Studio support, prefer these rules:

- Parse like DendryNexus, not like a simplified tutorial.
- Normalize internally, preserve source style externally.
- Treat capitalized, kebab-case, camelCase, and spaced directive variants as
  likely equivalent only after checking engine behavior.
- Keep generated output protected.
- Separate source evidence, file existence, and runtime rendering evidence.
- Index more than Studio can safely edit, but label unsafe edits honestly.
- Add fixtures from real project patterns when a field note changes behavior.
- Prefer small profile-specific router rules over broad source rewrites.

## Assumptions To Challenge

These assumptions have caused or can cause Studio bugs:

- "All directives are lowercase kebab-case."
- "If an image path appears in text, it is an image directive."
- "If the ProjectIndex sees an image reference, Runtime Preview must render it."
- "`on-departure` is rare enough to ignore."
- "`max-cards` is display metadata only."
- "Folder name alone tells us whether a scene is an event, card, deck, or hand."
- "A working generated `out/html` surface means a safe source edit exists."
- "Community examples are parser grammar."
- "Every parser-valid top-level scene has an editable `@scene_id` line."
- "Every deck is an independent top-level scene."
- "A `go-to:` line is one indivisible route edge."
- "Deleting a branch section is safe once the section body has exact source
  evidence." Incoming option and route clauses can still reference it.

Each of these should become a test when it affects user-visible editing.

## Fixture Checklist

When a new DendryNexus lesson changes Studio behavior, add or update a fixture
that proves the exact lesson. A compact parser-valid fixture file might include:

```dry
Title: Visible title
faceImage: img/portraits/example.jpg
setBg: img/backgrounds/example.jpg
On-departure: seen_case_variant_scene = true

Body text.

- @blocked_choice: Blocked choice
- chooseIf: relation_score >= 2
- unavailableSubtitle: Need better relations.

@blocked_choice
Title: Blocked choice

The gated branch is visible in source and safe to index.
```

Then verify:

- ProjectIndex retains normalized scene fields.
- Filename-derived scene ids are not offered as direct source-line edits.
- Section-owned decks are represented as deck-like objects where UI workflows
  need deck evidence.
- Card wiring proposals can guarded-insert a new `- #tag` route into either a
  top-level deck scene or a section-owned deck anchor.
- Text corpus includes visible metadata.
- Asset index records the directive role and path.
- Variable/effect evidence includes hook reads and writes.
- Existing-object editing opens the right fields.
- Install-plan generation preserves source spans and refuses ambiguous rewrites.

## Documentation Maintenance

Keep this file practical:

- Add real examples only when they teach a parser or editing boundary.
- Mark uncertain behavior as a question, not a rule.
- Link future checks or fixtures when they encode a lesson.
- Remove stale assumptions once Studio or DendryNexus behavior changes.

The best version of this document should feel like shared workshop knowledge:
specific enough to prevent repeat bugs, humble enough to be corrected by the
next real project.
