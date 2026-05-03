# Dendry Mod Studio

[English](README.md)

[![Checks](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml/badge.svg)](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml)
[![Windows EXE](https://img.shields.io/badge/下載-Windows%20EXE-2563eb?style=for-the-badge&logo=windows)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-win-x64.exe)
[![Linux AppImage](https://img.shields.io/badge/下載-Linux%20AppImage-15803d?style=for-the-badge&logo=linux)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.AppImage)
[![Linux Deb](https://img.shields.io/badge/下載-Linux%20Deb-b45309?style=for-the-badge&logo=debian)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.deb)

Dendry Mod Studio 是給 Dendry / DendryNexus 專案使用的桌面工具。它幫助 Mod 作者檢查場景、事件、變數、素材、玩家可見文本與安裝計畫，先看清楚再修改專案檔案。

目前版本是 `v0.9.2`。這是未簽章的 preview build，所以 Windows 可能會出現 SmartScreen 提示。Release artifacts 會包含桌面版 indexer 使用的 Python runtime。

## 下載

最新測試版會放在 [GitHub Releases](https://github.com/Wen387/DendryModStudio/releases)：

- Windows：`DendryModStudio-win-x64.exe`
- Linux AppImage：`DendryModStudio-linux-x64.AppImage`
- Linux Deb：`DendryModStudio-linux-x64.deb`

上方按鈕使用 GitHub 的 latest non-draft Release。如果你把某次 build 標成 prerelease，請改用上方 Releases 頁面連結。若 Releases 還沒有檔案，可以先到 Actions 頁面下載最新成功的 `Desktop Release` workflow artifact。

## 第一次使用

開啟桌面版後，可以從 Quick Start 選擇內建 Demo Template。Studio 會把 Demo 複製到 app data 資料夾作為可編輯專案，因此你可以安全地測試事件文本、選項、變數效果、條件與預覽流程。

要開啟自己的專案，請選擇包含 `source/info.dry` 的資料夾。

## 主要功能

- 檢查場景、事件、卡片、新聞、變數、素材與診斷。
- 在 Design view 觀察故事流與相關內容。
- 為支援的事件、卡片、文本、新聞與素材流程建立 proposal-first 修改。
- 在套用前審查 install plan。
- 在桌面版中用暫存專案複本進行 dry-run 與 runtime preview。
- 從 GitHub-hosted manifest 預覽公告、更新歷史與測試/聯絡入口。

## 安全邊界

- 瀏覽器版只做 review，不會直接套用修改。
- 桌面版只會 dry-run 或 apply 被分類為 safe、guarded、explicitly advanced 的操作。
- manual-review 與 refused 操作不會被自動套用。
- Runtime Preview 使用暫存 baseline / modified 複本，不會修改真實專案資料夾。
- `out/html`、`out/game.json`、`.git` 這類生成或版本控制輸出受到保護，不會被自動改寫。

## 從源碼啟動

先安裝根目錄依賴：

```bash
npm ci
```

執行核心檢查：

```bash
npm run check:ci
```

啟動瀏覽器版 Studio：

```bash
python3 tools/project_map/launch_studio.py --no-open
```

啟動 Electron 桌面版：

```bash
cd tools/project_map/desktop
npm ci
npm run start
```

## 發佈打包

桌面版打包流程由 `.github/workflows/release.yml` 處理。

- 手動 workflow run 一定會上傳 Actions artifacts。
- 手動 workflow run 可以在啟用 `publish_release` 並填入 release tag 後建立 GitHub Release。
- 推送 `v*` tag 會自動建立 prerelease。
- Linux build 會產生 AppImage 與 Deb。
- Windows build 會產生未簽章 NSIS installer。

## 回報問題

回報問題時，請附上 Studio 版本、作業系統、使用的是瀏覽器版或桌面版，以及你當時正在做的操作。請不要上傳私人筆記、access token、SSH private key，或未檢查過的 save / 專案資料。
