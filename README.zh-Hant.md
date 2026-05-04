# Dendry Mod Studio

[English](README.md)

[![Checks](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml/badge.svg)](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml)
[![Windows EXE](https://img.shields.io/badge/Download-Windows%20EXE-2563eb?style=for-the-badge&logo=windows)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-win-x64.exe)
[![Linux AppImage](https://img.shields.io/badge/Download-Linux%20AppImage-15803d?style=for-the-badge&logo=linux)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.AppImage)
[![Linux Deb](https://img.shields.io/badge/Download-Linux%20Deb-b45309?style=for-the-badge&logo=debian)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.deb)

Dendry Mod Studio 是一個預覽版桌面工具，用來探索、檢查並安全編輯 Dendry / DendryNexus 專案。它可以幫助作者在真正改動專案檔案前，先查看 scenes、events、cards、news、variables、assets、玩家可見文字，以及 install plan。

目前預覽版本是 `v0.9.3`。Release build 尚未簽章，所以 Windows 可能會顯示 SmartScreen 警告。桌面版 release artifacts 已包含專案 indexer 需要的 Python runtime。

## 下載

請從 [GitHub Releases](https://github.com/Wen387/DendryModStudio/releases) 下載最新預覽版：

- Windows：`DendryModStudio-win-x64.exe`
- Linux AppImage：`DendryModStudio-linux-x64.AppImage`
- Linux Deb：`DendryModStudio-linux-x64.deb`

上方 badges 指向 GitHub 的 latest non-draft Release。如果某個 build 只以 prerelease 發布，請打開 Releases 頁面，選擇對應的預覽版。

## 第一次使用

1. 安裝並打開桌面版 App。
2. 選擇 **Quick Start**。
3. 開啟內建的 **Demo Template**，用它安全試用 Studio。

Demo Template 會先複製到你的 app data 資料夾，再作為可編輯專案開啟。因此你的修改會落在可寫入的專案副本，不會改到 App 打包內的資源。

如果要開啟自己的專案，請選擇包含以下檔案的資料夾：

```text
source/info.dry
```

## 可以做什麼

- 探索 scenes、events、cards、news、variables、assets 和 diagnostics。
- 使用 Design view 查看故事流程與相關內容。
- 為支援的 event、card、text、news、asset、sidebar 和 metadata 工作流程建立 proposal-first 修改。
- 在套用前檢查 install plan。
- 在桌面版中 dry-run 安全修改。
- 使用暫存專案副本建立 Runtime Preview 對照。
- 從內建的 static manifest 顯示更新公告、版本歷史、測試與聯絡連結。

## 安全模型

- Browser mode 只能檢視，不會套用修改。
- Desktop mode 只會套用被分類為 safe、guarded 或明確 advanced 的操作。
- manual-review 和 refused 操作不會自動套用。
- Runtime Preview 會建立暫存 baseline / modified 副本，不會直接 patch 真實專案資料夾。
- `out/html`、`out/game.json`、`.cache`、`node_modules` 和 `.git` 等產物不會被自動來源編輯流程改動。
- 更新公告不是靜默自動更新器。App 只會在你點擊後開啟 release 或下載連結。

## Runtime Preview 注意事項

Runtime Preview 可能只需要幾秒，也可能因專案大小、磁碟速度、防毒掃描或首次冷建置而需要幾分鐘。桌面版目前允許 Runtime Preview build 最多 5 分鐘，大型專案 indexing 最多 10 分鐘。

如果預覽建立失敗，請保留診斷文字。最有用的 issue report 會包含 Studio 版本、作業系統、專案類型、你點擊的操作，以及 Runtime Preview diagnostics 裡第一個 build error。

## 從原始碼建置

從 source checkout 開發需要 Node.js/npm 和 Python 3。Release installer 會包含桌面版 App 使用的 Python runtime，但本機開發檢查會使用你的系統 Python。在 Windows 上，請安裝 Python 3 讓 `py` launcher 可用，或在跑檢查前把 `PYTHON` 設成 Python executable。

先安裝 root dependencies：

```bash
npm ci
```

執行核心檢查：

```bash
npm run check:ci
```

啟動 browser viewer：

```bash
python3 tools/project_map/launch_studio.py --no-open
```

啟動 Electron 桌面版：

```bash
cd tools/project_map/desktop
npm ci
npm run start
```

## 常用開發檢查

```bash
npm run check:ci
cd tools/project_map/desktop
npm run smoke
npm run doctor
```

更多工程細節在 [tools/project_map/README.md](tools/project_map/README.md)。Release 準備筆記在 [docs/releases/v0.9.3-dev-preview.md](docs/releases/v0.9.3-dev-preview.md)，給測試者看的預覽版說明在 [tools/project_map/RELEASE_NOTES_v0.9.3.md](tools/project_map/RELEASE_NOTES_v0.9.3.md)。

## Release Builds

桌面版 release packaging 由 [.github/workflows/release.yml](.github/workflows/release.yml) 處理。

- 手動 workflow run 一定會上傳 Actions artifacts。
- 如果啟用 `publish_release` 並提供 release tag，手動 workflow run 也可以發布 GitHub Release。
- 推送 `v*` tag 會自動發布 prerelease。
- Linux build 包含 AppImage 和 Deb。
- Windows build 包含未簽章的 NSIS installer。

## 回報問題

回報問題時，請提供：

- Studio 版本。
- 作業系統。
- Browser mode 或 desktop mode。
- 使用 Demo Template 還是自己的專案。
- 你原本想完成的操作。
- 畫面上看到的診斷訊息。

除非你已經刻意準備好安全的重現專案，否則請不要上傳私人筆記、access token、SSH private key、未審查的 save files，或私人專案資料。
