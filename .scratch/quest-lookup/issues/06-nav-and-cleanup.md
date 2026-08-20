# 06 — nav 註冊與清掉 sample

Status: ready-for-agent
Blocked by: 05

- `src/nav.ts` 加 `{ key: "quests", label: "任務查詢", icon: "📜", path: "quests", enabled: true }`，排在 `monsters` 後面
- **刪掉整個 `src/app/quests/sample/`**（page.tsx + sample-data.ts）
- 確認 `src/app/monsters/item-tooltip.tsx` 新增的 `name` / `info` / `searchLabel` 可選參數仍被正式頁使用；
  若 04 的 helper 讓 tooltip 可以直接查到任務道具，這三個參數可以考慮收回（怪物頁沒用到它們）
