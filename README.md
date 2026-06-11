# Dendry Mod Studio

[繁體中文](README.zh-Hant.md)

[![Checks](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml/badge.svg)](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml)
[![Windows EXE](https://img.shields.io/badge/Download-Windows%20EXE-2563eb?style=for-the-badge&logo=windows)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-win-x64.exe)
[![Linux AppImage](https://img.shields.io/badge/Download-Linux%20AppImage-15803d?style=for-the-badge&logo=linux)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.AppImage)
[![Linux Deb](https://img.shields.io/badge/Download-Linux%20Deb-b45309?style=for-the-badge&logo=debian)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.deb)
[![macOS Setup](https://img.shields.io/badge/macOS-Run%20from%20source-6e6e6e?style=for-the-badge&logo=apple)](docs/macos-from-source.md)

Dendry Mod Studio is a preview desktop tool for exploring, reviewing, and safely editing Dendry / DendryNexus projects. It helps authors inspect scenes, events, cards, news, variables, assets, player-facing text, and install plans before changing project files.

The current preview version is `v0.98.1`. Release builds are unsigned, so Windows may show a SmartScreen warning. Desktop release artifacts include the Python runtime used by the project indexer.

## Download

Download the latest preview build from [GitHub Releases](https://github.com/Wen387/DendryModStudio/releases):

- Windows: `DendryModStudio-win-x64.exe`
- Linux AppImage: `DendryModStudio-linux-x64.AppImage`
- Linux Deb: `DendryModStudio-linux-x64.deb`

The badges point to GitHub's latest non-draft Release. If a build is published only as a prerelease, open the Releases page and choose the matching preview release there.

### Platform Support

The Studio is developed and tested primarily on Linux. Windows builds are provided and actively maintained, but may have more rough edges — please report any Windows-specific issues you encounter.

### macOS

Official macOS builds are not available yet. You can run the app from
source by following the
[macOS setup guide](docs/macos-from-source.md) — it walks you through
each step, no prior experience with Terminal needed.

This is a hobby-driven project maintained in limited personal time. Platform coverage reflects that reality.

## First Run

1. Install and open the desktop app.
2. Choose **Quick Start**.
3. Open the bundled **Demo Template** to try the Studio safely.

The demo template is copied into your app data folder before it opens, so edits affect a writable project copy rather than packaged application resources.

To open your own project, choose a folder that contains:

```text
source/info.dry
```
## Community Mods

The following community mods are known to work with Dendry and can be opened in the Studio. Compatibility varies — see Known Issues for details.

- [Social Democracy: An Alternate History](https://github.com/aucchen/social_democracy_alternate_history) (original, well tested)
- [Dynamic Social Democracy](https://github.com/originn0/dynamic_social_democracy) (stress-tested, partial support)
- [2 Steps, 1 Leap](https://github.com/passionario/2steps_1leap)
- [Social Democracy Redux](https://github.com/cuttlecraft/social_democracy_redux)
- [Biennio Rosso: An Alternate History](https://github.com/AwesDes/biennio_rosso_alternate_history)

To open a community mod in the Studio: click the green **Code** button on its GitHub page, choose **Download ZIP**, and extract the archive. Then use **Open Project** in the Studio and select the extracted folder.

Note that third-party mods may use coding patterns the Studio does not fully support. If you encounter issues, please include the mod name and version in your report.

## Preview Disclaimer

Dendry Mod Studio is in early preview. It is published primarily to gather feedback on real-world usage, identify missing features, and surface environment-specific issues — not as a production-ready modding tool.

**If you are planning to build a mod you intend to maintain, consider using an IDE and editing project source directly.** The Studio's internal representation of Dendry projects is still changing, and future releases may alter how edits are stored or applied. This means mods created or modified with the current version are **not guaranteed to be forward-compatible** with later Studio releases.

You are welcome to experiment, file issues, and help shape the tool's direction — but please treat any work done in the Studio as potentially breakable across updates.

## Known Issues

The following are known limitations in the current preview. If you encounter any of these (or anything else), filing a GitHub Issue with details is always appreciated.

**Incomplete language switching.** The Studio supports both English and Chinese, but switching languages mid-session may leave some UI text unrefreshed. If you see mixed-language labels after switching, restart the app. Most text is dynamically rendered, but some static strings may have been missed — if you spot one, please report it so it can be fixed.

**Heuristic event editing.** The Studio can inspect and edit more SDAAH-style event structures than earlier previews, including many options, option results, effects, follow-up sections, and inline conditional text. It still relies on source-backed parsing and safety checks, so non-standard code structures can misfire or fall back to manual review. Always review install plans carefully before applying changes.

**D3 election-result support is specialized.** SDAAH-style `d3.parliament` result screens can be detected and previewed, but this is not a universal election editor. Presidential elections, narrative election events, and heavily custom renderers should usually be treated as normal events or manual-review work.

**Uneven mod support.** The Studio is developed and tested primarily against public Dendry projects and small bundled examples. Third-party mods that follow similar coding conventions to the original game will likely work, but compatibility is not guaranteed. If you hit a mod-specific issue, please include the mod name and version in your report — this information is often essential for diagnosis. Mods with highly idiosyncratic coding patterns may never be fully supported by the Studio; for these cases, direct source editing in an IDE remains the recommended workflow.

**Large project performance.** Indexing and loading large mods can be noticeably slow. This is a known performance issue with no current fix. If you experience poor load times, including your hardware specs (CPU, RAM, disk type) in the report helps identify whether the bottleneck is I/O, parsing, or something else.

## What It Can Do

- Explore scenes, events, cards, news, variables, assets, system UI surfaces, and diagnostics.
- Use Design view to inspect story flow and related content.
- Create proposal-first changes for supported event, card, text, news, asset, sidebar, system UI, election-result, and metadata workflows.
- Inspect and propose edits for many SDAAH-style composite events, including player options, option results, effects, conditions, and follow-up sections.
- Review install plans before applying changes.
- Dry-run safe changes in the desktop app.
- Build Runtime Preview comparisons from temporary project copies.
- Show update notices, release history, and testing/contact links from the bundled static manifest.

## Reporting Issues

You do not need to be a developer to file a useful bug report. If something looks wrong, crashes, or behaves unexpectedly, your report helps — even if you are not sure what caused it.

### Where to report

Open a GitHub Issue at [github.com/Wen387/DendryModStudio/issues](https://github.com/Wen387/DendryModStudio/issues). You will need a free GitHub account.

### What to include

A good report helps reproduce the problem. Try to cover as many of these as you can:

1. **Studio version** — shown in the app's About or title bar (e.g. `v0.98.1`).
2. **Operating system** — Windows 10, Windows 11, Ubuntu, etc.
**Hardware specs** (if relevant) — CPU, RAM, and disk type (SSD/HDD). Particularly useful for performance-related reports such as slow loading or preview timeouts.
3. **Desktop or browser mode.**
4. **Which project** — the bundled Demo Template, the original SDAAH, or a third-party mod. If it is a mod, include the mod name and version — this is often the single most important detail for mod-related bugs.
5. **What you did** — the steps that led to the problem, as specifically as you can. "I clicked Edit on the second event in chapter 3" is far more useful than "editing doesn't work."
6. **What you expected to happen** vs. **what actually happened.**
7. **Any error text or diagnostic message** — copy-paste is better than a screenshot of text, but a screenshot is better than nothing.

If you are not sure whether something is a bug or just a feature that does not exist yet, report it anyway. The worst that happens is it gets recategorised.

### What NOT to include

Do not upload private access tokens, SSH keys, passwords, or personal save files. If reproducing the issue requires project files, either use the Demo Template or prepare a minimal test project that does not contain private data.

## Feature Requests

If you wish the Studio could do something it cannot, open a GitHub Issue with the title prefixed `[Feature Request]` and describe:

- **What you are trying to accomplish** — not just "add X button," but the underlying task. "I want to preview how a card looks after I change its conditions" tells me more than "add a card preview button," because there may be multiple ways to solve the same problem.
- **How you currently work around it** — if you are editing files manually, switching to another tool, or simply giving up, that context helps prioritise.
- **Which mod or project type this matters for** — some requests may only make sense for specific game structures.

Not every request will be implemented, and the Studio's scope is intentionally limited — it is meant to complement direct source editing, not replace it entirely. But knowing what real users actually need is the most valuable input the project can receive right now, so please do not hesitate.

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

## Quick Development Preview

From the repository root, the fastest browser preview is:

```bash
npm run studio:preview
```

This opens the bundled Demo Template and is the quickest way to check the
current Studio UI after pulling or editing code. If you want the server URL
without opening a browser automatically, use:

```bash
npm run studio:preview:no-open
```

To preview a real Dendry project instead of the bundled demo:

```bash
npm run studio:preview -- --root /path/to/project
```

To open the desktop app from the repository root:

```bash
npm --prefix tools/project_map/desktop ci
npm run studio:app
```

After the desktop dependencies are installed once, `npm run studio:app` is the
only command needed for normal desktop launches.

To launch the desktop app for a *specific branch* — handy for comparing work in
progress without switching your own checkout:

```bash
npm run studio:branch
```

This lists every local branch and launches the chosen one's latest desktop app.
The branch you currently have checked out runs in place; any other branch runs
from a throwaway worktree at its tip (borrowing the installed `node_modules` by
symlink) that is removed again when you close the app. Your working tree and
current branch are never touched. Pass a branch name to skip the picker, or list
the branches as JSON:

```bash
npm run studio:branch -- main
npm run studio:branch:list
```

Run the core checks:

```bash
npm run check:ci
```

Useful launcher checks:

```bash
npm run studio:preview:plan
npm run check:launch
```

`studio:preview:plan` prints the launch plan without generating an index or
starting a server. `check:launch` verifies the launcher shortcuts and read-only
browser preview contract.

## Useful Developer Checks

```bash
npm run check:ci
npm run check:launch
npm run studio:app:smoke
npm run studio:app:doctor
```

Additional engineering notes live in [tools/project_map/README.md](tools/project_map/README.md). Release preparation notes live in [docs/releases/v0.98.1-dev-preview.md](docs/releases/v0.98.1-dev-preview.md), and tester-facing preview notes live in [tools/project_map/RELEASE_NOTES_v0.98.1.md](tools/project_map/RELEASE_NOTES_v0.98.1.md).

## Release Builds

Desktop release packaging is handled by [.github/workflows/release.yml](.github/workflows/release.yml).

- Manual workflow runs always upload Actions artifacts.
- Manual workflow runs can publish a GitHub Release when `publish_release` is enabled and a release tag is provided.
- Pushing a `v*` tag publishes a prerelease automatically.
- Linux builds include AppImage and Deb packages.
- Windows builds include an unsigned NSIS installer.
