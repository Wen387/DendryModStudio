# Dendry Mod Studio

[繁體中文](README.zh-Hant.md)

[![Checks](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml/badge.svg)](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml)
[![Windows EXE](https://img.shields.io/badge/Download-Windows%20EXE-2563eb?style=for-the-badge&logo=windows)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-win-x64.exe)
[![Linux AppImage](https://img.shields.io/badge/Download-Linux%20AppImage-15803d?style=for-the-badge&logo=linux)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.AppImage)
[![Linux Deb](https://img.shields.io/badge/Download-Linux%20Deb-b45309?style=for-the-badge&logo=debian)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.deb)

Dendry Mod Studio is a preview desktop tool for exploring, reviewing, and safely editing Dendry / DendryNexus projects. It helps authors inspect scenes, events, cards, news, variables, assets, player-facing text, and install plans before changing project files.

The current preview version is `v0.9.3`. Release builds are unsigned, so Windows may show a SmartScreen warning. Desktop release artifacts include the Python runtime used by the project indexer.

## Download

Download the latest preview build from [GitHub Releases](https://github.com/Wen387/DendryModStudio/releases):

- Windows: `DendryModStudio-win-x64.exe`
- Linux AppImage: `DendryModStudio-linux-x64.AppImage`
- Linux Deb: `DendryModStudio-linux-x64.deb`

The badges point to GitHub's latest non-draft Release. If a build is published only as a prerelease, open the Releases page and choose the matching preview release there.

## First Run

1. Install and open the desktop app.
2. Choose **Quick Start**.
3. Open the bundled **Demo Template** to try the Studio safely.

The demo template is copied into your app data folder before it opens, so edits affect a writable project copy rather than packaged application resources.

To open your own project, choose a folder that contains:

```text
source/info.dry
```
## Preview Disclaimer

Dendry Mod Studio is in early preview. It is published primarily to gather feedback on real-world usage, identify missing features, and surface environment-specific issues — not as a production-ready modding tool.

**If you are planning to build a mod you intend to maintain, consider using an IDE and editing project source directly.** The Studio's internal representation of Dendry projects is still changing, and future releases may alter how edits are stored or applied. This means mods created or modified with the current version are **not guaranteed to be forward-compatible** with later Studio releases.

You are welcome to experiment, file issues, and help shape the tool's direction — but please treat any work done in the Studio as potentially breakable across updates.

## Known Issues

The following are known limitations in the current preview. If you encounter any of these (or anything else), filing a GitHub Issue with details is always appreciated.

**Incomplete language switching.** The Studio supports both English and Chinese, but switching languages mid-session may leave some UI text unrefreshed. If you see mixed-language labels after switching, restart the app. Most text is dynamically rendered, but some static strings may have been missed — if you spot one, please report it so it can be fixed.

**Fragile event editing.** The Studio edits existing game events by pattern-matching against source code and inferring replacement targets. This heuristic approach means edit operations can misfire, especially on non-standard code structures. Expect bugs in this area; always review install plans carefully before applying changes.

**Uneven mod support.** The Studio is developed and tested primarily against the original SDAAH and one unreleased first-party mod. Third-party mods that follow similar coding conventions to the original game will likely work, but compatibility is not guaranteed. If you hit a mod-specific issue, please include the mod name and version in your report — this information is often essential for diagnosis. Mods with highly idiosyncratic coding patterns may never be fully supported by the Studio; for these cases, direct source editing in an IDE remains the recommended workflow.

## What It Can Do

- Explore scenes, events, cards, news, variables, assets, and diagnostics.
- Use Design view to inspect story flow and related content.
- Create proposal-first changes for supported event, card, text, news, asset, sidebar, and metadata workflows.
- Review install plans before applying changes.
- Dry-run safe changes in the desktop app.
- Build Runtime Preview comparisons from temporary project copies.
- Show update notices, release history, and testing/contact links from the bundled static manifest.

## Safety Model

- Browser mode is review-only.
- Desktop mode applies only operations classified as safe, guarded, or explicitly advanced.
- Manual-review and refused operations are not applied automatically.
- Runtime Preview builds temporary baseline and modified copies instead of patching the real project folder.
- Generated runtime output such as `out/html`, `out/game.json`, `.cache`, `node_modules`, and `.git` is excluded from automatic source edits.
- Update notices are not a silent auto-updater. The app opens release or download links only after you click them.

## Runtime Preview Notes

Runtime Preview can take from a few seconds to a few minutes depending on project size, disk speed, antivirus scanning, and whether the machine is doing a cold build. The desktop app currently allows up to 5 minutes for a preview build and up to 10 minutes for indexing large projects.

If preview generation fails, keep the diagnostic text. The most useful issue reports include the Studio version, operating system, project type, the action you clicked, and the first build error shown in the Runtime Preview diagnostics.

## Build From Source

Source checkouts need Node.js/npm and Python 3. Release installers bundle the Python runtime used by the desktop app, but local development checks use your system Python. On Windows, install Python 3 so the `py` launcher works, or set `PYTHON` to a Python executable before running checks.

Install root dependencies once:

```bash
npm ci
```

Run the core checks:

```bash
npm run check:ci
```

Start the browser viewer:

```bash
python3 tools/project_map/launch_studio.py --no-open
```

Start the Electron desktop app:

```bash
cd tools/project_map/desktop
npm ci
npm run start
```

## Useful Developer Checks

```bash
npm run check:ci
cd tools/project_map/desktop
npm run smoke
npm run doctor
```

Additional engineering notes live in [tools/project_map/README.md](tools/project_map/README.md). Release preparation notes live in [docs/releases/v0.9.3-dev-preview.md](docs/releases/v0.9.3-dev-preview.md), and tester-facing preview notes live in [tools/project_map/RELEASE_NOTES_v0.9.3.md](tools/project_map/RELEASE_NOTES_v0.9.3.md).

## Release Builds

Desktop release packaging is handled by [.github/workflows/release.yml](.github/workflows/release.yml).

- Manual workflow runs always upload Actions artifacts.
- Manual workflow runs can publish a GitHub Release when `publish_release` is enabled and a release tag is provided.
- Pushing a `v*` tag publishes a prerelease automatically.
- Linux builds include AppImage and Deb packages.
- Windows builds include an unsigned NSIS installer.

## Reporting Issues

When reporting a problem, include:

- Studio version.
- Operating system.
- Browser or desktop mode.
- Whether you used the Demo Template or your own project.
- The action you were trying to complete.
- Any visible diagnostic message.

Do not upload private notes, access tokens, SSH private keys, unreviewed save files, or private project data unless you have intentionally prepared a safe reproduction project.
