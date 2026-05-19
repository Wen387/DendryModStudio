# Dendry Mod Studio

[English](README.md)

[![Checks](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml/badge.svg)](https://github.com/Wen387/DendryModStudio/actions/workflows/ci.yml)
[![Windows EXE](https://img.shields.io/badge/Download-Windows%20EXE-2563eb?style=for-the-badge&logo=windows)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-win-x64.exe)
[![Linux AppImage](https://img.shields.io/badge/Download-Linux%20AppImage-15803d?style=for-the-badge&logo=linux)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.AppImage)
[![Linux Deb](https://img.shields.io/badge/Download-Linux%20Deb-b45309?style=for-the-badge&logo=debian)](https://github.com/Wen387/DendryModStudio/releases/latest/download/DendryModStudio-linux-x64.deb)

Dendry Mod Studio 是一款預覽版桌面工具，用於探索、檢視與安全編輯 Dendry / DendryNexus 專案。它協助作者在修改專案檔案前，先行檢查場景、事件、卡片、新聞、變數、素材、玩家可見文字與安裝計畫。

目前預覽版本為 `v0.97.5`。發布版本未經簽署，因此 Windows 可能會顯示 SmartScreen 警告。桌面發布包含專案索引器所使用的 Python 執行環境。

## 下載

從 [GitHub Releases](https://github.com/Wen387/DendryModStudio/releases) 下載最新預覽版本：

- Windows：`DendryModStudio-win-x64.exe`
- Linux AppImage：`DendryModStudio-linux-x64.AppImage`
- Linux Deb：`DendryModStudio-linux-x64.deb`

上方徽章連結至 GitHub 最新的非草稿版本。若某個版本僅以預發布形式發布，請前往 Releases 頁面手動選擇對應的預覽版本。

### 平台支援

Studio 主要在 Linux 上開發與測試。Windows 版本有提供並積極維護，但可能存在更多粗糙的地方——如遇到 Windows 特定問題，歡迎回報。

目前不支援 macOS。由於應用程式基於 Electron 構建，技術上可以製作 macOS 版本，若需求增加可能會考慮。在此之前，歡迎針對 macOS 支援的貢獻或社群 fork。

這是一個在有限個人時間內維護的興趣專案，對不同平臺的支援和測試實在力有未逮。

## 初次執行

1. 安裝並開啟桌面應用程式。
2. 選擇**快速開始**。
3. 開啟內建的**示範範本**以安全試用 Studio。

示範範本在開啟前會複製到你的應用程式資料夾，因此編輯操作只會影響可寫入的專案副本，而不會動到應用程式本身的資源。

若要開啟自己的專案，請選擇包含以下路徑的資料夾：

```text
source/info.dry
```

## 社群 Mod

以下社群 mod 已知可在 Dendry 中正常運作，並可在 Studio 中開啟。相容性因 mod 而異——詳見已知問題。

- [Social Democracy: An Alternate History](https://github.com/aucchen/social_democracy_alternate_history)（原版，測試最完整）
- [Dynamic Social Democracy](https://github.com/originn0/dynamic_social_democracy)（壓力測試較多，但仍屬部分支援）
- [2 Steps, 1 Leap](https://github.com/passionario/2steps_1leap)
- [Social Democracy Redux](https://github.com/cuttlecraft/social_democracy_redux)
- [Biennio Rosso: An Alternate History](https://github.com/AwesDes/biennio_rosso_alternate_history)

在 Studio 中開啟社群 mod 的方式：在該 mod 的 GitHub 頁面點擊綠色的 **Code** 按鈕，選擇 **Download ZIP**，解壓縮後，於 Studio 中使用**開啟專案**並選取解壓縮後的資料夾。

請注意，第三方 mod 可能使用 Studio 尚未完整支援的程式碼模式。若遇到問題，請在回報時附上 mod 名稱與版本。

## 預覽免責聲明

Dendry Mod Studio 目前處於早期預覽階段。發布的主要目的是收集實際使用的回饋、找出缺少的功能，以及發現與特定環境相關的問題——並非作為可投入生產的 Mod 製作工具。

**如果你正在計畫製作一個需要長期維護的 mod，建議使用 IDE 直接編輯專案原始碼。** Studio 對 Dendry 專案的內部表示方式仍在變動中，未來版本可能會改變編輯內容的儲存或套用方式。這意味著以目前版本建立或修改的 mod **無法保證與未來的 Studio 版本向前相容**。

歡迎試用、提交問題，並協助塑造工具的發展方向——但請將在 Studio 中進行的任何工作視為可能在更新後損壞的內容。

## 已知問題

以下是目前預覽版的已知限制。若遇到任何問題（包括以下列出的或其他問題），非常歡迎在 GitHub 提交包含詳細資訊的 Issue。

**語言切換不完整。** Studio 同時支援英文與中文，但在同一工作階段中途切換語言，可能導致部分介面文字未能刷新。若切換後看到中英文混雜的標籤，請重新啟動應用程式。大多數文字是動態渲染的，但仍可能有部分靜態字串尚未處理——若你發現這類問題，請回報以便修正。

**事件編輯仍是啟發式。** Studio 目前能檢視與編輯比早期版本更多的 SDAAH 風格事件結構，包括許多玩家選項、選項結果、效果、後續分支與行內條件文本。但它仍依賴 source-backed 解析與安全檢查，遇到非標準程式碼結構時仍可能判斷錯誤，或退回人工審閱。套用變更前務必仔細檢查安裝計畫。

**D3 選舉結果支援是專門化功能。** Studio 可以偵測並預覽 SDAAH 風格的 `d3.parliament` 結果頁，但這不是通用選舉編輯器。總統選舉、敘事型選舉事件，以及高度自訂的 renderer 通常應視為一般事件或人工審閱工作。

**Mod 支援參差不齊。** Studio 主要以公開 Dendry 專案與內建小型範例進行開發與測試。遵循與原版遊戲類似程式碼慣例的第三方 mod 通常可以運作，但相容性不作保證。若遇到 mod 特定的問題，請在回報時附上 mod 名稱與版本——這項資訊對診斷問題往往至關重要。程式碼風格高度特殊的 mod 可能永遠無法獲得 Studio 的完整支援；這類情況下，建議仍以 IDE 直接編輯原始碼。

**大型專案效能問題。** 索引並載入大型 mod 可能明顯偏慢。這是已知的效能問題，目前尚無解決方案。若載入速度緩慢，請在回報中附上硬體規格（CPU、記憶體、硬碟類型），有助於判斷瓶頸在 I/O、解析或其他環節。

## 功能說明

- 探索場景、事件、卡片、新聞、變數、素材、系統 UI 表面與診斷資訊。
- 使用設計檢視來查看故事流程與相關內容。
- 針對支援的事件、卡片、文字、新聞、素材、側邊欄、系統 UI、選舉結果與元資料工作流程，建立提案優先的變更。
- 檢視並提出許多 SDAAH 風格複合事件的編輯，包括玩家選項、選項結果、效果、條件與後續分支。
- 在套用變更前審閱安裝計畫。
- 在桌面應用程式中對安全變更進行空跑測試。
- 從臨時專案副本建立執行期預覽比對。
- 從內建靜態清單顯示更新通知、發布歷程，以及測試與聯絡連結。

## 回報問題

你不需要是開發者才能提交有用的錯誤回報。若有任何東西看起來不對、崩潰或行為異常，你的回報都有幫助——即使你不確定原因為何。

### 回報位置

前往 [github.com/Wen387/DendryModStudio/issues](https://github.com/Wen387/DendryModStudio/issues) 開啟 GitHub Issue，需要免費的 GitHub 帳號。

### 回報內容

好的回報有助於重現問題。請盡量涵蓋以下資訊：

1. **Studio 版本** — 顯示於應用程式的「關於」或標題列（例如 `v0.97.5`）。
2. **作業系統** — Windows 10、Windows 11、Ubuntu 等。
   **硬體規格**（若相關）— CPU、記憶體，以及硬碟類型（SSD/HDD）。對載入緩慢或預覽逾時等效能問題特別有用。
3. **桌面模式或瀏覽器模式。**
4. **使用的專案** — 內建示範範本、原版 SDAAH，或第三方 mod。若是 mod，請附上名稱與版本——這往往是診斷 mod 相關錯誤最關鍵的一項資訊。
5. **操作步驟** — 盡可能具體描述導致問題的步驟。「我點擊了第三章第二個事件的編輯按鈕」遠比「編輯功能壞了」有用。
6. **預期發生的情況**與**實際發生的情況**。
7. **任何錯誤文字或診斷訊息** — 複製貼上優於截圖文字，但截圖仍優於什麼都沒有。

若不確定某件事是 bug 還是尚未實作的功能，請照樣回報。最壞的情況不過是被重新分類。

### 請勿包含的內容

請勿上傳私人存取權杖、SSH 金鑰、密碼或個人存檔。若重現問題需要專案檔案，請使用示範範本，或準備一個不含私人資料的最小測試專案。

## 功能請求

若希望 Studio 能做到目前做不到的事，請在 GitHub 開啟一個以 `[Feature Request]` 為標題前綴的 Issue，並說明：

- **你想達成什麼目標** — 不只是「加一個 X 按鈕」，而是背後的實際需求。「我想預覽更改卡片條件後的樣子」比「加一個卡片預覽按鈕」更有參考價值，因為同一個問題可能有多種解決方式。
- **目前如何繞過限制** — 若你正在手動編輯檔案、切換到其他工具，或乾脆放棄，這些背景資訊有助於排定優先順序。
- **這對哪種 mod 或專案類型最重要** — 某些請求可能只對特定遊戲結構有意義。

並非每個請求都會實作，且 Studio 的範疇是刻意有所侷限的——它的設計是補充直接原始碼編輯，而非完全取代它。但了解真實使用者的實際需求，是目前這個專案最有價值的輸入，因此請不要猶豫，儘管提出。

## 安全模型

- 瀏覽器模式僅供檢視，不進行任何修改。
- 桌面模式僅套用分類為安全、受保護或明確標示為進階的操作。
- 需人工審閱或被拒絕的操作不會自動套用。
- 執行期預覽會建立臨時的基準版本與修改版本副本，而非直接修改真實的專案資料夾。
- 生成的執行期輸出（如 `out/html`、`out/game.json`、`.cache`、`node_modules`、`.git`）不包含在自動原始碼編輯的範圍內。
- 更新通知不是靜默的自動更新器。應用程式只有在你點擊後，才會開啟發布或下載連結。

## 執行期預覽注意事項

執行期預覽所需時間從幾秒到幾分鐘不等，取決於專案大小、磁碟速度、防毒軟體掃描，以及是否為冷啟動構建。桌面應用程式目前允許預覽構建最多 5 分鐘，大型專案索引最多 10 分鐘。

若預覽生成失敗，請保留診斷文字。最有用的問題回報應包含：Studio 版本、作業系統、專案類型、你點擊的操作，以及執行期預覽診斷中顯示的第一個構建錯誤。

## 從原始碼構建

原始碼需要 Node.js/npm 與 Python 3。發布安裝包已內建桌面應用程式所需的 Python 執行環境，但本地開發的檢查使用你的系統 Python。在 Windows 上，請安裝 Python 3 以讓 `py` 啟動器正常運作，或在執行檢查前將 `PYTHON` 環境變數設定為 Python 執行檔路徑。

安裝根目錄依賴（執行一次即可）：

```bash
npm ci
```

執行核心檢查：

```bash
npm run check:ci
```

啟動瀏覽器檢視器：

```bash
python3 tools/project_map/launch_studio.py --no-open
```

啟動 Electron 桌面應用程式：

```bash
cd tools/project_map/desktop
npm ci
npm run start
```

## 實用開發者檢查

```bash
npm run check:ci
cd tools/project_map/desktop
npm run smoke
npm run doctor
```

其他工程說明位於 [tools/project_map/README.md](tools/project_map/README.md)。發布準備說明位於 [docs/releases/v0.97.5-dev-preview.md](docs/releases/v0.97.5-dev-preview.md)，測試人員版本說明位於 [tools/project_map/RELEASE_NOTES_v0.97.5.md](tools/project_map/RELEASE_NOTES_v0.97.5.md)。

## 發布構建

桌面發布打包由 [.github/workflows/release.yml](.github/workflows/release.yml) 處理。

- 手動觸發的工作流程執行一律上傳 Actions 產物。
- 手動觸發時，若啟用 `publish_release` 並提供發布標籤，可發布 GitHub Release。
- 推送 `v*` 標籤會自動發布預發布版本。
- Linux 構建包含 AppImage 與 Deb 套件。
- Windows 構建包含未簽署的 NSIS 安裝程式。
