# IslandSunrise Authoring Contract for Studio

本文件描述 Dendry Mod Studio 可以依賴的 IslandSunrise source 慣例。它的目的不是限制遊戲設計，而是避免遊戲引擎友善化後讓 Studio parser 大規模失效。

## Stable Profile Identity

- Profile id: `islands-sunrise`
- Inherits: `generic-dendry` -> `sdaah-style` -> `islands-sunrise`
- User-facing advisor-like label: `Circle` / `Circles`

Studio 可以把 IslandSunrise 視為 SDAAH-style 的 project-specific extension，但不能把 IslandSunrise 特有規則倒灌成所有 SDAAH-like project 的通用規則。

## Stable Router Files

Studio 可以把以下檔案視為高風險 router / aggregation layers：

- `source/scenes/root.scene.dry`
- `source/scenes/post_event.scene.dry`
- `source/scenes/post_event_news.scene.dry`

Rules:

- `post_event.scene.dry` 不允許 whole-file workflows。工具應使用 bounded read、section anchor、或 ProjectIndex evidence。
- 新變數需要 root init 與 post_event migration guard。
- Dense router install 只有在有明確 anchor / dedupe evidence 時才可 guarded apply；否則必須 manual review。

## Stable Variable Families

Studio 可以使用以下變數 prefix 作為語義分類提示，而不是完整遊戲邏輯的替代：

- `district_`, `*_seats_v3`, `local_county_`
- `local_governance_`, `local_base_`, `local_capacity_`
- `collective_`, `edge_`, `tag_`
- `cov_R`, `apathy_`, `mobilization_`, `party_capture_`
- `identity_`, `profile_`, `left_independence`, `progressive_taiwanese`, `democratic_socialism`
- `circle_`, `democratic_infra_`
- `founding_`
- `diplomatic_`, `china_`, `defense_`, `crisis_`

這些 family 只能幫助 Studio 分類、搜尋、提示與保守 install 判斷。它們不是授權 Studio 自動改寫系統公式。

## Protected Boundaries

Studio 必須保守處理：

- `out/html/` generated / custom runtime UI evidence。
- `cov_` / `pop_R` coverage and population layer writes。
- `district_winner_`, `district_share_`, `*_seats_v3` district result writes。
- `post_event.scene.dry` central router edits。

`out/html` 可以作為 surface text 或 runtime evidence，但不應成為自動修改目標。

## Engine-Friendliness Change Rule

若遊戲 repo 做以下變更，必須同步更新本 contract 與 fixture，或在 PR / release notes 中明示 Studio 不再保證相容：

- 改變 central router 檔名、anchor 慣例或 migration block。
- 新增 / 退役一個主要變數 family。
- 改變 Circle / district / local / collective / coverage 的 source layout。
- 將原本 source-backed text 移到 generated UI，或反向移動。
- 改變 build wrapper 或 protected `out/html` restore policy。
- 引入 Studio 應理解的新 authoring DSL。

## Non-Contract Details

以下不應被 Studio parser 依賴：

- 單一事件的敘事文案。
- 單一數值 threshold。
- 暫時性 debug 變數。
- 尚未文件化的 experiment scene。
- 完整 `post_event.scene.dry` 行號。

Studio 應依 ProjectIndex evidence 與本 contract 的 stable families 工作，而不是把當前遊戲 source 的所有細節都視為長期 API。
