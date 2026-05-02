# Scenario: justice_party_template_mod

Persona: A player who has never edited Dendry source files wants to prototype a
Korean Justice Party mod from the bundled template.

Goal: Start from the Studio template, use Studio guidance to understand the
existing demo event, modify the welcome page/sidebar/first playable route,
customize the starter hand/deck/advisor surface, add a new deck/sidebar
category, edit an existing source-backed Sidebar / Status section, then create
a small mod set: a routed party-affairs hand card, a persistent advisor, a
campaign event, a traditional monthly-popup style news beat, and an Island-style
ticker news proposal.

Required checkpoints:

- Quick Start opens the bundled Demo Template as a writable project copy.
- Explore shows the template event and the existing `demo_support` variable.
- Entry & Sidebar changes the start menu title, welcome text, sidebar/status
  text, and first playable target.
- Create first event seeds a World Event draft whose id matches the new first
  playable target.
- Entry & Sidebar Review & Apply produces guarded `replace_section` operations
  for source-backed root/status text.
- Playable Surface changes the starter hand, deck, first action card, and
  advisor labels/body text into a Justice Party party-affairs workspace.
- Playable Surface Review & Apply produces guarded operations against the
  source-backed hand/deck/card/advisor scenes.
- Workspace Layout creates a Justice Party media deck lane, seeds a first media
  briefing card, inserts a hand route, and inserts a sidebar category from
  source-backed anchors.
- Workspace Layout Review & Apply dry-run succeeds for the deck/card creates
  plus hand/sidebar guarded inserts.
- Sidebar / Status changes an existing source-backed status category and adds a
  variable-backed conditional status line.
- Sidebar / Status Review & Apply dry-run succeeds with guarded status title and
  `replace_section` operations.
- Card Wizard creates a Justice Party party-affairs card routed through the
  starter deck tag.
- Card Wizard creates a Justice Party labor advisor routed through the starter
  advisor/pinned-card tag.
- Review & Apply dry-run succeeds for both routed card scene creates.
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

Why this scenario matters: it tests a fuller first playable route in one player
journey. The player should be able to shape the welcome page, sidebar, party
hand, deck lanes, existing status categories, labor advisor lane, campaign
event, and two news systems without editing raw source first.
