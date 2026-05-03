# Dendry Mod Studio

[繁體中文](README.zh-Hant.md)

[![Checks](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml/badge.svg)](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml)
[![Windows EXE](https://img.shields.io/badge/Download-Windows%20EXE-2563eb?style=for-the-badge&logo=windows)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-win-x64.exe)
[![Linux AppImage](https://img.shields.io/badge/Download-Linux%20AppImage-15803d?style=for-the-badge&logo=linux)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.AppImage)
[![Linux Deb](https://img.shields.io/badge/Download-Linux%20Deb-b45309?style=for-the-badge&logo=debian)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.deb)

Dendry Mod Studio is a desktop tool for exploring and editing Dendry / DendryNexus projects. It helps mod authors inspect scenes, events, variables, assets, player-facing text, and install plans before changing project files.

The current version is `v0.9.2`. It is an unsigned preview build, so Windows may show SmartScreen warnings and Linux still requires system Python 3.

## Download

Download the latest preview build from [GitHub Releases](https://github.com/Wen387/DendryModStudio/releases):

- Windows: `DendryModStudio-win-x64.exe`
- Linux AppImage: `DendryModStudio-linux-x64.AppImage`
- Linux Deb: `DendryModStudio-linux-x64.deb`

The badges use GitHub's latest non-draft Release. If you publish a build as a prerelease, use the Releases page link above instead. If no Release is available yet, use the latest successful `Desktop Release` workflow artifact from the Actions tab.

## First Run

Open the desktop app and choose the bundled Demo Template from Quick Start. The template is copied into your app data folder as an editable project, so you can safely experiment with event text, options, variables, conditions, and preview flows.

To open your own project, choose a folder that contains `source/info.dry`.

## What It Does

- Explore scenes, events, cards, news, variables, assets, and diagnostics.
- Use Design view to inspect story flow and related content.
- Create proposal-first changes for supported event, card, text, news, and asset workflows.
- Review install plans before applying changes.
- Run desktop-only dry-runs and runtime previews on temporary project copies.
- Preview announcements, update history, and testing/contact links from the bundled GitHub-hosted manifest.

## Safety

- Browser mode is review-only.
- Desktop mode can dry-run or apply only operations classified as safe, guarded, or explicitly advanced.
- Manual-review and refused operations are not applied automatically.
- Runtime Preview builds temporary baseline and modified copies instead of patching the real project folder.
- Generated runtime output such as `out/html`, `out/game.json`, and `.git` is protected from automatic edits.

## Build From Source

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

## Release Builds

Desktop release packaging is handled by `.github/workflows/release.yml`.

- Manual workflow runs always upload Actions artifacts.
- Manual workflow runs can also publish a GitHub Release when `publish_release` is enabled and a release tag is provided.
- Pushing a `v*` tag publishes a prerelease automatically.
- Linux builds include AppImage and Deb packages.
- Windows builds include an unsigned NSIS installer.

## Reporting Issues

When reporting a problem, include the Studio version, operating system, whether you used browser or desktop mode, and the action you were trying to complete. Do not upload private notes, access tokens, SSH private keys, or unreviewed save/project data.
