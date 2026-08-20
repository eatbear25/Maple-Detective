# 03 — 圖示：擴充 download-icons.py + 抓轉蛋機

Status: partial（2026-08-20）——道具圖示 40/101、轉蛋機 sprite 完成；其餘 61 個台服專屬道具 maplestory.io 沒有，見 ../research-item-icons.md
Blocked by: 02

## A. 道具圖示

`tools/download-icons.py` 的 `main()` 目前讀 `reference-data/monster-book.json`。
一併讀 `src/data/generated/gacha.json`，把 101 筆 prize 的 `itemId` 併進 item 抓取清單。

沿用既有規則：TMS/209 優先、GMS/62 備援、已存在跳過、可重複執行。
輸出 `public/icons/item/<id>.png`。

抓不到的要印出清單——前端需要 fallback（顯示 `#id`）。

## B. 轉蛋機 sprite（新增類別）

加一個 `npc` 類別，輸出 `public/icons/npc/<id>.png`：

```
https://maplestory.io/api/TMS/209/npc/<id>/render/stand
```

要抓的（已驗證全部 HTTP 200）：

| id | 名稱 | 用途 |
|---|---|---|
| **9110011** | 勇士之村楓葉轉蛋機 | **主要**——對應遊戲截圖裡那台（機身有紅楓葉） |
| 9110015 | 超級轉蛋機 | 備用 |

先抓這兩台就好，其他城鎮版本外觀相同。

## 注意

遊戲內 UI 用的是**高解析抗鋸齒版**，跟這裡抓的 NPC sprite 不是同一張。
決定先用 NPC sprite——免費、立刻可得，放大後的顆粒感反而更復古。
若之後要 100% 還原才去挖客戶端 atlas（風險見 memory 的 `client-map-render-blocker`）。
