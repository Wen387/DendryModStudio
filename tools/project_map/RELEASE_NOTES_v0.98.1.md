# Dendry Mod Studio v0.98.1 Dev Preview Notes

Date: 2026-05-30

## Status

v0.98.1 is an unsigned developer-facing preview build on the v0.98 preview
line. It carries forward the spatial canvas LOD zoom, drag-to-snap card
stacking, music asset editing, and all previous route-understanding, guided
editing, object editor, install review, Runtime Preview, Starter Demo, and
governance work.

Release artifacts use these names:

- `DendryModStudio-win-x64.exe`
- `DendryModStudio-linux-x64.AppImage`
- `DendryModStudio-linux-x64.deb`

GitHub Actions builds all three through the `Desktop Release` workflow. A local
Linux build writes AppImage and Deb files under
`tools/project_map/desktop/dist-builder/`; these are ignored local outputs and
must be rebuilt and retested before sharing.

## What Changed Since v0.98

### Template Hub

The Studio can now download and manage game template projects directly from
within the app. The Template Hub panel on the Welcome Surface lets you browse
available community templates, download them from GitHub Releases, and open
them with one click.

- **Split asset archives** — templates with large art assets (images and music)
  download a separate asset archive after the source archive, so small
  source-only updates don't re-download hundreds of megabytes of art.
- **Data-loss safeguards** — SHA-256 file snapshot tracking, local-edit
  detection before destructive operations, automatic backup of modified files,
  and stash-swap extraction rollback.
- **Template info cards** — installed templates show scene, variable, event,
  and file counts for a quick project overview.
- **Standalone entry** — the Template Hub is accessible from a topbar button in
  catalog-only mode, not just from the Welcome Surface.

### Runtime Preview Debug Panel

The debug panel for Runtime Preview was overhauled from a static 24-variable
HTML list into a full interactive sidebar.

- **Typed inputs** — boolean variables use a toggle switch, numeric variables
  get a number input, and text variables get a text field.
- **Grouped by meaning** — variables are automatically categorized into
  Event Flags, Time & Gates, Relationships, Resources, and Game State.
- **Pin and search** — pin frequently used variables to a persistent favorites
  section; search across all groups by name.
- **Known-value autocomplete** — text-type variables show a dropdown of known
  values extracted from project source files, so you don't have to remember
  exact strings like chancellor names.
- **Full localization** — the entire debug sidebar is localized in both
  Traditional Chinese and English.
- **Fullscreen debug** — baseline and modified fullscreen views access the
  debug toolbar through the compare page URL parameter.

### Object Canvas Editing

Condition, route, and effect editing in the Object Canvas received targeted
improvements.

- **Route target picker** — autocomplete scene search for go-to and set-jump
  targets, with semantic distinction for set-jump, call, and on-departure
  route types.
- **Inline condition editing** — compound condition structural preview for
  and/or chains; editable condition cards replace read-only chips.
- **Variable picker** — expression-parsed effect cards and structure builder
  forms now offer a variable picker for choosing target variables.
- **Condition remove** — remove button placed next to condition cards for
  quick deletion.

### Bug Fixes

- **Cross-mod install plan leak** — switching to a different mod now
  automatically clears a stale install plan that belongs to the previous
  project. A manual "Clear plan" button is also available.
- **Cross-mod draft workspace leak** — draft workspace localStorage is now
  scoped per project; old global-key items are migrated on first load.
- **Storyboard cross-project pollution** — card colors, palette pins, and
  recent items are now scoped per project instead of shared globally.
- **Duplicate face-image directives** — the asset add slot checks existing
  directives (not just roles), preventing DendryNexus metadata errors.
- **Project cache reliability** — the fingerprint computation is now
  consistent between save and check, so caching actually works on the next
  startup. Locally edited templates force a fresh scan instead of serving a
  stale pre-built index.
- **Manual index rebuild** — a "Rebuild Index" button forces a full project
  rescan without restarting the app, useful when the cache appears stale.

## Known Limitations

- Card stacking is a visual organization aid and is not persisted across
  sessions. Stack membership lives in the runtime workspace state only.
- The LOD system uses `prefers-reduced-motion` to keep `will-change` permanent
  on weak hardware (smooth but potentially blurry text).
- This is still an unsigned preview build. Please keep backups of real
  projects, review install plans before applying changes, and report any
  confusing editor behavior or broken preview output.
