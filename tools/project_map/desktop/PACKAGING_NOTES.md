# Dendry Mod Studio Desktop Packaging Notes

## v0.9.6 Dev Preview Scope

v0.9.6 aligns the desktop feasibility package with the current Mod Studio
source/dev preview. It includes the v0.9 authoring and review surface, the
unified Event Structure editing work, Dynamic Mod pressure-audit coverage,
Existing Scene Editor condition edits, variable candidates, Runtime Preview
sandbox / debug bridge, the latest localization/version cleanup, and the
Explore / Design performance pass: cached Explore rows, virtual Text / Assets /
News lists, and Design inspector caching. It also includes the Update Notice
MVP: static manifest polling, the bundled `update_manifest.json`
schema/example, and a manual in-app notice banner. It remains a local
feasibility package, not a signed public release.

The release workflow uses `electron-builder` for Linux AppImage, Linux Deb, and
Windows NSIS packages. The local `package:deb` script remains available for
diagnosing Debian package layout and keeps these release-hygiene behaviors:

- keeps the Debian `Depends:` line focused on Electron runtime libraries when a
  bundled Python runtime is present, with `python3` used only by local fallback
  packages that were assembled without the runtime;
- installs a simple app icon into the hicolor theme and references it from the
  desktop entry;
- cleans temporary packaging work directories and stale same-architecture
  `.deb` artifacts by default, leaving only the final `.deb` under ignored
  `dist/`.

Use `npm run package:deb -- --keep-workdirs` only when debugging the staged
package layout.

2026-05-01 desktop release workflow note: GitHub Actions now has a
tag/manual release workflow for Linux AppImage, Linux Deb, and Windows NSIS
`.exe` builds through `electron-builder`. The builder config packs
Electron-readable app files, browser resources, the parser wrapper, and root
`node_modules` into `app.asar`, while keeping the Python runtime, Python
indexer, profiles, and bundled Starter Demo as loose resources available
through normal filesystem paths.
These artifacts are still unsigned dev-preview packages; Windows may show
SmartScreen warnings, but users should not need to install Python separately.

2026-05-03 bundled Python note: `npm run dist:linux`, `npm run dist:win`, and
the release workflow fetch a redistributable python-build-standalone runtime
into `tools/project_map/desktop/runtime/python/` before packaging. The desktop
doctor and scanner prefer that bundled runtime and fall back to `PYTHON`/system
Python only for development or local fallback packages assembled without the
runtime.

2026-05-03 NSIS cleanup note: the Windows installer now includes
`build/installer.nsh` and removes the old packaged runtime / Project Map
resource directories during upgrade uninstall so preview rebuilds don't keep a
stale app payload in place.

2026-05-04 version note: the preview package version was advanced to v0.9.3 so
Windows, Deb, and update-notice metadata can distinguish this build from older
v0.9.2 preview artifacts.

2026-05-09 version note: the preview package version was advanced to v0.9.6.
Release packages now include the Python `indexer/` package beside
`build_project_map.py`, so packaged scans use the same semantic ProjectIndex
builder as the development checkout.

2026-05-10 version note: the preview package version was advanced to v0.9.66
for the Windows installer performance release. The version keeps the v0.9.65
editing scope and formalizes the faster `deps-in-asar` Windows package layout
as the normal `dist:win` build.

2026-05-19 version note: the preview package version was advanced to v0.97.6 for
the broader UI, onboarding, authoring, and release-readiness preview. It keeps
the previous fast Windows packaging layout while carrying the newer Studio
authoring, Runtime Preview, and governance checks.

2026-05-10 Windows install performance experiment: branch
`exp-windows-install-performance` adds a non-release `fast-install` Windows
builder config and measurement helpers. The experiment identified loose root
`node_modules` as the main Defender/installation slowdown, so the normal
`dist:win` release config now uses the `deps-in-asar` layout:

- `npm run dist:win`: builds the normal Windows NSIS installer with
  `node_modules` and `parse_dry_project.js` packed into `app.asar`; Python,
  templates, profiles, and the Python indexer remain loose resources.

- `npm run dist:win:fast-install`: builds a Windows NSIS variant under
  `dist-builder/fast-install/` with `asar` enabled for Electron-readable app
  resources, trimmed loose resource filters, and installer compression set to
  `store` so installation speed can be measured against a larger artifact.
- `npm run analyze:payload`: reports source payload file counts and sizes for
  the desktop resources most likely to affect Windows installation time.
- `npm run measure:win-install -- -InstallerPath path\to\installer.exe`: runs
  repeated silent installs on Windows and writes JSON timings.
- `npm run dist:win:no-python`: builds a diagnostic-only Windows installer
  under `dist-builder/no-python/` without the bundled Python runtime. This
  package is not release-ready; it exists to isolate whether Defender is mainly
  spending time scanning the Python runtime payload.
- `npm run dist:win:no-node-modules`: builds a diagnostic-only Windows
  installer under `dist-builder/no-node-modules/` without bundled Python or root
  `node_modules`. This isolates whether the remaining Defender cost is mostly
  from packaged JavaScript dependencies.
- `npm run dist:win:deps-in-asar`: builds a Windows diagnostic installer under
  `dist-builder/deps-in-asar/` using the same resource layout as normal
  `dist:win`, but with a distinct artifact name for before/after comparisons.
- `npm run dist:win:shell-only`: builds a diagnostic-only Windows installer
  under `dist-builder/shell-only/` with only the Electron shell and minimal
  startup support files. This estimates the unsigned Electron + NSIS baseline
  cost on Windows.

The fast-install config intentionally keeps Python, the Python indexer,
profiles, templates, and bundled Dendry runtime modules as loose resources so
child processes can still use normal filesystem paths. `studio_core.js`
understands this split layout by loading the browser app from `app.asar` while
preferring loose `resources/app/project_map` backend files when they exist.

2026-05-04 Windows app icon note: Windows release builds now include a generated
multi-size `assets/dendry-mod-studio.ico`, wire it into `win.icon`, the NSIS
installer/uninstaller, the packaged portable assets, and the Electron
`BrowserWindow` icon path. The app also sets the Windows AppUserModelId to the
same value as `build.appId`, so pinned taskbar/start-menu entries should resolve
the branded icon instead of Electron's fallback icon.

2026-04-30 packaging note: local portable and Deb packaging checks cover the
resource layout used by the desktop app. Run `npm run smoke` and
`npm run doctor` before sharing artifacts for testing.

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

At the time, the `.deb` declared `Depends: python3`; current release builds now
bundle the Python runtime.

This remains a feasibility package, not a public release candidate. Code
signing, icons, update channels, production maintainer metadata, and full
runtime library dependency curation remain future work.

## v0.5.2 Scope

v0.5.2 is a portable packaging slice. It proves that the Electron
desktop shell can be assembled into an unpacked app and a Linux-friendly
portable archive without relying on repository-relative app resources.

It is not a public `.deb` or `.exe` installer.

## Current Deliverables

- `npm run package:dir` creates `dist/DendryModStudio-<platform>-<arch>/`.
- `npm run package:portable` creates
  `dist/DendryModStudio-<platform>-<arch>.tar.gz`.
- `npm run package:deb` creates
  `dist/dendry-mod-studio_<version>_amd64.deb` on Linux.
- `npm run dist:linux` creates unsigned AppImage and Deb artifacts under
  `dist-builder/`.
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

## Current Runtime Dependency

Release AppImage, Deb, and Windows NSIS artifacts include the Python runtime
used by the desktop indexer. Local packaging helpers still support a fallback
mode without `runtime/python/`; those local fallback packages report the missing
bundled runtime in doctor output and may depend on system Python 3.

## Installer Boundary

- `.deb` is produced by both the local Debian helper and the release workflow.
- `.exe` is produced by the release workflow on Windows.
- Code signing, public maintainer metadata, full clean-VM dependency curation,
  uninstall UX beyond normal package-manager behavior, and full update channels
  are not part of v0.9.3. The current update notice path only polls a static
  manifest and opens manual links after a user action; it is not an auto-install
  updater.

The release workflow keeps artifacts unsigned until the project has a stable
code-signing and update-channel plan.

## Next Packaging Slice

The next installer slice should focus on polish rather than basic artifact
creation:

- Linux `.deb`: test installation on clean Debian/Ubuntu systems and confirm
  desktop-menu integration.
- Windows installer: test bundled Python discovery, unsigned SmartScreen
  behavior, start-menu/taskbar icon refresh after upgrading from older preview
  builds, and future code signing expectations.
- Bundled Python: add checksum verification and clean-VM install checks for each
  release artifact.

Until then, the recommended test path is:

```bash
cd tools/project_map/desktop
npm run smoke
npm run doctor
npm run dist:linux
```
