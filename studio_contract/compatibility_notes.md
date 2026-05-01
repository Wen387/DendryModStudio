# Compatibility Notes

## Recommended Split Model

Repo 分離後建議採用：

- IslandSunrise game repo：保留 `source/`, `out/html/`, `tools/build_and_validate.sh`, engine docs, `studio_contract/`。
- DendryModStudio repo：保留 Studio source、desktop packaging、generic/SDAAH/Island profile、player-like QA。
- Studio CI：可把 IslandSunrise repo 的 `studio_contract/` checkout 為外部 fixture。

## Compatibility Review Checklist

任何 engine 或 source-layout 工作若碰到下列項目，需要跑或更新 contract：

- Router: `root`, `post_event`, `post_event_news`
- Migration: 新變數 root init + old save guard
- Profile detection: path / filename / content hints
- Semantic systems: district, local, collective, coverage, identity, circle, founding, diplomacy
- Install safety: safe / guarded / advanced / manual / refused 邊界
- Runtime UI evidence: `out/html` 是否只是 evidence，還是被誤當 source-backed target

## Studio Repo Consumption

Studio repo 不應要求完整 IslandSunrise source 才能維持 parser regression。最低要求是：

1. 讀取 `contract.json`。
2. 掃描 `parser_fixture/`。
3. 確認 profile chain 是 `generic-dendry`, `sdaah-style`, `islands-sunrise`。
4. 確認 fixture 中的 stable variable families 與 scene classes 仍被分類。

完整遊戲 repo 仍可作為 integration test，但不能是唯一相容性測試。

## Versioning

`contractVersion` 遞增原則：

- Patch: 只修文字或 fixture typo，不改 Studio 行為預期。
- Minor: 新增 stable variable family、scene class、capability 或 fixture evidence。
- Major: 移除或重命名 Studio 已依賴的 stable convention。
