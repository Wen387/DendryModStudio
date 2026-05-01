# Dendry Mod Studio Desktop Packaging Notes

## v0.9.2 Dev Preview Scope

v0.9.2 aligns the desktop feasibility package with the current Mod Studio
source/dev preview. It includes the v0.9 authoring and review surface, Existing
Scene Editor condition edits, variable candidates, Runtime Preview sandbox /
debug bridge, the latest localization/version cleanup, and the Explore / Design
performance pass: cached Explore rows, virtual Text / Assets / News lists, and
Design inspector caching. It also includes the Update Notice MVP: static
manifest polling, the bundled `update_manifest.json` schema/example, and a
manual in-app notice banner. It remains a local feasibility package, not a
signed public release.

The Linux `.deb` path still uses the hand-written local `dpkg-deb` flow after
a successful local install smoke, and keeps these release-hygiene behaviors:

- expands the Debian `Depends:` line beyond `python3` to include the common
  Electron runtime libraries used by GTK/NSS/X11/GBM/ALSA desktop sessions;
- installs a simple app icon into the hicolor theme and references it from the
  desktop entry;
- cleans temporary packaging work directories and stale same-architecture
  `.deb` artifacts by default, leaving only the final `.deb` under ignored
  `dist/`.

Use `npm run package:deb -- --keep-workdirs` only when debugging the staged
package layout.

2026-05-01 desktop release workflow note: GitHub Actions now has a
tag/manual release workflow for Linux AppImage and Windows NSIS `.exe` builds
through `electron-builder`. The builder config keeps `asar` disabled so the
Python indexer, bundled Starter Demo, Project Map resources, and DendryNexus
runtime files remain available through normal filesystem paths. These artifacts
are still unsigned dev-preview packages; Windows may show SmartScreen warnings,
and both Windows and Linux builds still require system Python 3.

2026-04-30 packaging note: source checkpoint `7dfdcbf` produced local ignored
artifacts `dist/DendryModStudio-linux-x64.tar.gz` and
`dist/dendry-mod-studio_0.9.2_amd64.deb`. `check_desktop_packaging.js`,
`check_desktop_deb.js`, and `npm run doctor` passed. A post-cleanup
`npm run smoke` previously timed out in one local automation run after 90 seconds
without an error stack; rerun it in a normal local terminal before public
release or invitee testing.

2026-04-30 hotfix note: the same v0.9.2 artifact names were rebuilt after
removing `url.pathToFileURL` from the preload script. Electron sandbox preload
can expose a reduced `url` module, so `assetBaseUrl` is now built with a local
file URL encoder and covered by a VM sandbox smoke using a `SDAAH Dynamic` path.

2026-04-30 UI hotfix note: the same v0.9.2 artifact names were rebuilt after
adding an Explore inspector width resizer and fixing narrow Assets usage rows
that could squeeze long source-path buttons into a one-character column.

2026-04-30 Design hotfix note: the same v0.9.2 artifact names were rebuilt
after fixing the Design inspector cache path that rendered `undefined` instead
of the selected card details.

2026-04-30 Runtime Preview hotfix note: the same v0.9.2 artifact names were
rebuilt after fixing localhost preview server startup. The desktop runtime
preview now waits for Node's `listen` callback before reading the assigned
port, so it no longer throws `Cannot read properties of null (reading 'port')`
when creating a compare page.

2026-04-30 Runtime Preview build hotfix note: the same v0.9.2 artifact names
were rebuilt after replacing the sandbox fallback build command. Runtime
Preview no longer calls bare `npx dendrynexus`, which can hit the npm registry
and fail because `dendrynexus` is supplied from Git/local sources. It now runs
the local `dendrynexus-main` CLI when present, or the bundled packaged
`node_modules/dendrynexus` CLI otherwise.

2026-04-30 Runtime Preview UX hotfix note: the same v0.9.2 artifact names were
rebuilt after separating preview creation from install-plan application
success. A guarded replacement mismatch is now reported as a warning/diagnostic
inside an openable preview instead of making the preview look unavailable.
The desktop UI can also create a no-change runtime preview for the current
project when no install plan is loaded.

2026-04-30 Runtime Preview root fallback note: the same v0.9.2 artifact names
were rebuilt after teaching the Install Assistant to fall back to the desktop
`lastProject.root` when no install plan is loaded and the local Install tab has
not yet received a ProjectIndex event. This keeps no-change previews available
immediately after opening a project.

2026-04-30 CardDraft go-to hotfix note: the same v0.9.2 artifact names were
rebuilt after fixing generated Card option sections that could expose
`go-to: root` as player-facing text. CardDraft now writes `go-to` as Dendry
section metadata before narrative prose, and `check_card_wizard_model.js`
parses the generated scene to keep that ordering from regressing.

2026-04-30 Runtime Preview Debug Console hotfix note: the same v0.9.2 artifact
names were rebuilt after fixing preview-only Debug Console interactions. Scene
jumps now use DendryEngine `goToScene()` so event title/body content renders
instead of only response options; variable Apply redraws the modified preview
and refreshes SDAAH-style sidebars; and the compare page Debug Console has a
persisted draggable width to avoid narrow-column overflow.

## v0.5.4 Scope

v0.5.4 hardened the Linux `.deb` feasibility package with runtime dependencies,
an app icon, and default cleanup of temporary packaging work directories.

## v0.5.3 Scope

v0.5.3 adds a Linux `.deb` feasibility package around the existing Electron
desktop shell. It uses local `dpkg-deb` and the already-built unpacked app
layout; it does not add Electron Forge as a project dependency.

The `.deb` declares `Depends: python3`. It does not bundle Python.

This remains a feasibility package, not a public release candidate. Code
signing, icons, update channels, production maintainer metadata, and full
runtime library dependency curation remain future work.

## v0.5.2 Scope

v0.5.2 is a portable packaging feasibility spike. It proves that the Electron
desktop shell can be assembled into an unpacked app and a Linux-friendly
portable archive without relying on repository-relative app resources.

It is not a public `.deb` or `.exe` installer.

## Current Deliverables

- `npm run package:dir` creates `dist/DendryModStudio-linux-x64/`.
- `npm run package:portable` creates
  `dist/DendryModStudio-linux-x64.tar.gz`.
- `npm run package:deb` creates
  `dist/dendry-mod-studio_<version>_amd64.deb` on Linux.
- `npm run dist:linux` creates an unsigned AppImage under `dist-builder/`.
- `npm run dist:win` creates an unsigned Windows NSIS `.exe` under
  `dist-builder/` when run on Windows.
- The portable bundle includes the viewer, parser wrapper, Python indexer,
  profiles, schemas, authoring core, bundled Starter Demo template, desktop
  scripts, `update_notice.js`, `update_manifest.json`, and root `node_modules`
  needed by the Dendry parser.
- The bundle includes `portable-manifest.json` with package kind, platform,
  executable path, app root, system dependency notes, and doctor checks.
- The `.deb` installs the app to `/opt/dendry-mod-studio`, installs a
  `/usr/bin/dendry-mod-studio` wrapper, and installs a desktop entry at
  `/usr/share/applications/dendry-mod-studio.desktop`.
- The `.deb` installs an icon at
  `/usr/share/icons/hicolor/scalable/apps/dendry-mod-studio.svg`.

## Current System Dependency

The portable and `.deb` packages still require system Python 3. The app checks
for Python and reports a friendly error when it is missing, but it does not
bundle Python.

Python bundling is a later installer slice because it needs platform-specific
size, licensing, path, and update decisions.

## Installer Boundary

- `.deb` is produced as a local feasibility package in v0.5.3+.
- `.exe` is not produced in v0.5.2.
- Code signing, public maintainer metadata, full clean-VM dependency curation,
  uninstall UX beyond normal package-manager behavior, and full update channels
  are not part of v0.9.2. The current update notice path only polls a static
  manifest and opens manual links after a user action; it is not an auto-install
  updater.

Electron's official docs recommend Electron Forge for full distributables, and
the Forge `.deb` maker requires external Linux packaging tools such as
`fakeroot` and `dpkg`. v0.5.2 intentionally keeps those dependencies out of the
project until the desktop shell and Python strategy are stable.

## Next Packaging Slice

The next installer slice should choose one target first:

- Linux `.deb`: add Electron Forge or another maker, document required external
  tools, and decide whether Python remains a system prerequisite.
- Windows installer: test Windows path handling, Python discovery, unsigned
  SmartScreen behavior, and future code signing expectations.
- Bundled Python: decide whether to ship a minimal embedded runtime, where it
  lives inside app resources, and how doctor chooses bundled versus system
  Python.

Until then, the recommended test path is:

```bash
cd tools/project_map/desktop
npm run doctor
npm run package:portable
npm run package:deb
```
