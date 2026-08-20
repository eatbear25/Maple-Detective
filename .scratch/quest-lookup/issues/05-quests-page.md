# 05 — /quests 正式頁

Status: ready-for-agent
Blocked by: 04

把 `src/app/quests/sample/page.tsx` 的樣式搬過來接真資料。**樣式已驗收，不要重新設計。**

## 從 sample 直接沿用

- `QuestCard`（A3 左等級徽）
- `Pager`（含等級區間標籤）
- `QuestChainCard`（置頂可收合系列卡片）
- `ItemRow`（`h-14 w-12` 直式格子、前兩字標籤、右上數量徽、hover tooltip）
- `RewardPopup`、`Modal`

## 要換掉／補上的

- `PAGE_SIZE` 8 → **50**
- 移除頂端的 SAMPLE 橫幅與 `selId` 寫死的 `"6102"`（改成預設不選或選第一筆）
- `chainOf()` 刪掉，改吃 02 算好的 `chain` 欄位
- `MapPopup` 換成真的 `WorldMapView`（照 `/monsters` 的世界地圖彈窗寫法）
- `sampleItemInfo` 換成 04 的 helper
- 用 `useSearchParams` 支援 `?q=`（照 `/monsters` 的寫法，含 `Suspense` + skeleton，避免閃爍）
- 為將來的 `/quests/<id>` 預留：詳情選取狀態走網址參數而不是純 state
