# Scenario: justice_party_template_mod

Persona: A player who has never edited Dendry source files wants to prototype a
Korean Justice Party mod from the bundled template.

Goal: Start from the Studio template, use Studio guidance to understand the
existing demo event, modify the start menu/sidebar/first playable route, then
create a small mod set: a campaign event, a traditional monthly-popup style
news beat, and an Island-style ticker news proposal.

Required checkpoints:

- Quick Start opens the bundled Demo Template as a writable project copy.
- Explore shows the template event and the existing `demo_support` variable.
- Entry & Sidebar changes the start menu title, sidebar/status text, and first
  playable target.
- Create first event seeds a World Event draft whose id matches the new first
  playable target.
- Entry & Sidebar Review & Apply produces guarded `replace_section` operations
  for source-backed root/status text.
- Variable recommendation in Create inserts `demo_support = 1` into a condition.
- Variable recommendation in Create places `demo_support` into the effect helper.
- The Justice Party campaign event saves to My Changes.
- The traditional news beat is created as a World Event, preserving the
  `tags: event, world` route used by monthly popup style systems.
- The Island-style news beat is created through News Wizard and produces a
  `post_event_news` install plan.
- Review & Apply dry-run succeeds for the monthly-popup event scene create.
- Review & Apply dry-run keeps the Island-style `post_event_news` path guarded
  or manual-review instead of pretending every template has an Island news
  router.
- My Changes still contains the full Justice Party draft set.

Allowed shortcut: the scenario uses deterministic Electron DOM interactions
instead of manual typing, but it still clicks the same Studio template, Create,
My Changes, Review & Apply, and dry-run surfaces a player would use.

Why this scenario matters: it tests two news systems in one player journey. The
traditional path treats player-facing news as a routed World Event. The
Island-style path uses News Wizard and `post_event_news`. The difference should
be visible to the player, not hidden in source assumptions.
