# Dendry Mod Studio

[English](README.md)

[![Public Export Checks](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml/badge.svg)](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml)
[![Windows EXE](https://img.shields.io/badge/下載-Windows%20EXE-2563eb?style=for-the-badge&logo=windows)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-win-x64.exe)
[![Linux AppImage](https://img.shields.io/badge/下載-Linux%20AppImage-15803d?style=for-the-badge&logo=linux)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.AppImage)

Dendry Mod Studio 是給 Dendry / DendryNexus 專案使用的本機 Mod 製作與審查工具。它可以掃描專案、顯示 Explore / Design 視圖、建立 proposal-first 修改、審查 install plan，並在桌面版中對支援的修改做受保護的 dry-run。

這個 repo 是 Studio 的乾淨獨立版本。它不包含 IslandSunrise 遊戲 source、私人開發筆記、會話紀錄、生成後的 runtime output、安裝包 artifact，或舊遊戲 repo 的 Git 歷史。

## 目前狀態

目前版本是 `v0.9.2` developer preview，適合本機測試、Mod 製作流程審查與邀請制 QA，但還不是已簽章的正式公開桌面版。上方下載按鈕會在 GitHub pre-release 發佈並附上 artifact 後，指向最新的 `.exe` / `.AppImage`。

程式碼以 MIT license 發佈。

## 下載

正式測試包會放在 GitHub Releases：

- Windows：`DendryModStudio-win-x64.exe`
- Linux：`DendryModStudio-linux-x64.AppImage`

目前 Windows `.exe` 未簽章，可能會出現 SmartScreen 或防毒提示。Linux AppImage 仍需要系統已安裝 Python 3。

## 快速開始

安裝根目錄依賴：

```bash
npm ci
```

啟動瀏覽器版 Studio：

```bash
python3 tools/project_map/launch_studio.py --no-open
```

接著打開終端機列出的本機網址。

啟動 Electron 桌面版：

```bash
cd tools/project_map/desktop
npm ci
npm run start
```

第一次使用時，可以從 Quick Start 載入內建 Demo Template。桌面版會把 demo 複製到 app data 內作為可寫專案，因此玩家可以直接在 demo 基礎上理解事件、選項、變數效果與條件。

## 安全邊界

- 瀏覽器版只做 review，不會直接套用修改。
- 桌面版只會 dry-run 或 apply 被分類為 safe、guarded、explicitly advanced 的操作。
- manual-review 與 refused 操作不會被自動套用。
- Runtime Preview 使用暫存 baseline / modified 複本，不會修改真實專案資料夾。
- `out/html`、`out/game.json`、`.git` 這類生成或版本控制輸出受到保護，不會被自動改寫。

## 更新公告

桌面版會讀取 `tools/project_map/desktop/update_manifest.json` 指向的靜態 GitHub raw URL。這是公告與更新通知系統，不是靜默自動更新器。只有使用者點擊時，才會開啟下載或 release notes 連結。

## 常用檢查

```bash
npm run check:ci
```

GitHub Actions 會在每次 push / pull request 跑同一組核心檢查。發佈準備筆記在 `docs/releases/v0.9.2-dev-preview.md`。

桌面版 `.exe` / `.AppImage` 發佈流程由 `.github/workflows/release.yml` 準備。

## 回報問題

回報問題時，請附上 Studio 版本、作業系統、使用的是瀏覽器版或桌面版，以及你當時正在做的操作。請不要上傳私人筆記、access token、SSH private key，或未檢查過的完整遊戲 save / 專案資料。
