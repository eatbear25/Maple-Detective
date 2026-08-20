# 02 — tools/build-quest-data.py

Status: ready-for-agent
Blocked by: 01

Join 出網站用的 `src/data/generated/quests.json`。獨立於 `build-site-data.py`（跟 `build-fashion-data.py` 同慣例）。

## 每個任務要產出

- `id` / `name`（QuestData）/ `series`（`Info.parent`，可為 null）
- `lv`（`Check["0"].lvmin`，無則 0）
- `npc` id + 中文名 + `npcMap`（透過 `npc-map.json` → 第一張在 `Map.json` 有名字的地圖）
- `released`：NPC 站在有名字的地圖上 → true。**部分實裝算 true**，只有完全查不到才 false（預期 166 個 false）
- `need`：`Check["1"].item` 的正數道具
- `rewards`：`Act` 各階段的**正數**道具（負數是系統收回，丟掉）
- `exp` / `money` / `pop` / `skill`
- `prereq`：`Check["0"].quest` 的 id 清單
- `chain`：**在這裡就把整條鏈算好排序**（用 prereq + `Act.nextQuest` 遍歷），
  前端拿到的是排好的 id 陣列，不要在瀏覽器跑圖演算法

## 還要輸出道具資料（重要，別漏）

任務道具**不在** `monster-drops.json` / `item-info.json` 裡（36 種只有 13 種查得到）。
本腳本要一併輸出任務道具的 `name` / `desc` / `eq`，來源同 `build-site-data.py`：
`name-tables/Item.json` 的 `name`+`desc`（`\n` 要還原）＋ `reference-data/equip-info.json`。
沒有這份，`/quests` 的道具 hover 彈窗會顯示 `#4031003`。

## 也要輸出

- 地圖 id → `{ street, name }`（給世界地圖彈窗用）
- 世界地圖點位：沿用 `worldmap-nav.json` / `monster-drops.json` 的 `wm` 結構，讓 `WorldMapView` 直接吃

寫 docstring 說明實裝判斷規則與鏈遍歷規則。
