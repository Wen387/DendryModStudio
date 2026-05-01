# IslandSunrise Studio Compatibility Contract

本目錄是 IslandSunrise 遊戲專案與 Dendry Mod Studio 之間的相容契約。

它不是 Studio 本體，也不是完整遊戲副本。它的用途是讓兩個 repo 分離後仍有共同語言：

- 遊戲 repo 在這裡宣告哪些 source 慣例是穩定承諾。
- Studio repo 依這份 contract 寫 profile、parser、install safety 與 fixture tests。
- 引擎 / LLM 友善化若改變 router、變數家族、source layout 或 protected UI 邊界，必須同步更新這裡。

## Files

- `contract.json`：機器可讀的最小 contract manifest。
- `contract.schema.json`：contract manifest 的 JSON Schema。
- `CHANGE_POLICY.md`：何時必須更新 contract、版本遞增規則與 review 問題。
- `authoring_contract.md`：人可讀的 source / engine / Studio 邊界。
- `compatibility_notes.md`：拆 repo 後的協調規則與變更流程。
- `parser_fixture/`：最小 Dendry project，用來驗證 Studio 仍能辨識 IslandSunrise profile。

## Validation

目前在遊戲 repo 內用：

```bash
node tools/check_studio_contract.js
```

這會檢查：

- contract JSON 與 Studio 目前的 `islands-sunrise` profile 是否對齊；
- contract 宣告的 semantic systems / variable families / protected boundaries 是否仍存在於 profile；
- `parser_fixture/` 是否可被 `build_project_map.py` 掃成 `generic-dendry`, `sdaah-style`, `islands-sunrise` 三層 profile；
- fixture 是否暴露 contract 要求的關鍵 scenes 與 variables。

## Split-Repo Rule

拆分後，IslandSunrise 遊戲 repo 應保留本目錄；Studio repo 可把本目錄當作外部 fixture 或 CI input。
不要把完整 `tools/project_map/` 長期留在遊戲 repo 當作相容性的唯一來源。
