# 任務查詢 /quests — 規格

Status: ready-for-agent
定案來源：2026-08-19 的 /grill-me 拷問（21 題全部答完）。樣式已用 sample 頁驗收通過。

## 目標

楓之谷經典版的遊戲內任務查詢站。欄位：任務名／需求等級／需求道具／獎勵／NPC／NPC 所在地／前置任務／系列任務。

## 已驗證的資料事實（不要重新推導）

全部任務資料在同一個 <1MB 的 json bundle（掃描時是 `json_d0204d274fe26485581cd3b21891ab84.bundle`，
檔名每次更新會變，用 container path 定位）：

| container path | 內容 | 筆數 |
|---|---|---|
| `Assets/WzAssets/Json/Quest/QuestInfo.wzjson` | `area` / `order`（**文字是空殼**） | 485 |
| `Assets/WzAssets/Json/Quest/Check.wzjson` | `npc` / `lvmin` / `lvmax` / `item` / `quest`(前置) / `job` / `mob` | 490 |
| `Assets/WzAssets/Json/Quest/Act.wzjson` | `item`(可負數) / `exp` / `money` / `skill` / `pop` / `nextQuest` | 485 |
| `Assets/WzAssets/Json/Quest/Say.wzjson` | NPC 對話（**本專案不使用**） | 485 |
| `Assets/WzAssets/Json/String/TW/QuestData.json` | 中文任務名 + `Info.parent`(系列名) + 說明 | 494 |

重要陷阱：

- **`QuestInfo` 的字串值池只有 12 筆，內容是欄位名本身**（`name`/`parent`/`demandSummary`…）。
  Gamania 把文字掏空做本地化，所有中文一律從 `String/TW/QuestData.json` 拿。
  連帶 `rewardSummary`(40 筆) / `demandSummary`(33 筆) 在客戶端**是空的**，做不出來。
- **`QuestData.json` 是 UTF-8**，不是 Big5。用 `m_Script.encode('utf-8','surrogateescape').decode('utf-8')`。
- `wzjs.py` 沒有 bug，Map 檔的字串解得完全正常。

### NPC → 地圖反查

`Check` 只給 NPC id。掃 `Map/` 包（`json_573635e…`，44MB）裡 **705 張**數字命名的
`Map/MapN/<9碼>.wzjson`，讀 `life` 節點裡 `type == "n"` 的 `id`，即可建 npc→map。
705 已確認是全部（另外 79/75/72 個 container 是 Back/Tile/Obj 素材，不是地圖）。

- 任務用到 155 個 NPC，**97 個（62%）**查得到地圖；涉及的 62 張地圖 **100%** 在 `Map.json` 有中文名。
- 查不到的 58 個：57 個屬於完全未實裝任務；**14 個是正常號段**（`2020009`/`2081000`/`2043000`…），
  不在任何地圖的 `life` 上，判定為腳本動態生成的劇情 NPC。
- NPC 中文名覆蓋 154/155。

### 實裝判斷

規則：**任務的 NPC 是否站在「客戶端 Map.json 有名字」的地圖上**。分佈：

- NPC 全部實裝 **296**
- 部分實裝 **28**
- 完全未實裝／無 NPC **166**

定案（Q15=B）：**296 + 28 算現行版本，只有 166 掛「未實裝」灰徽章**。

### 其他統計

- 獎勵道具 317 種，312 種在 `Item.json` 有中文名。
- `Act` 的道具有 **391 筆是負數**（系統收回任務道具），**一律不顯示**。
- 系列：241 個任務有 `parent`（且 100% 有前後關聯）、169 個有關聯但無 `parent`、75 個是孤立單發。

## 設計定案

- **骨架**：搜尋框 + 列表 + 右側詳情面板（`/monsters` 同款）。
- **搜尋維度**：任務名 + 獎勵道具名。**不搜** NPC 名、**不搜**需求道具。
- **列表卡片**：A3 左等級圓徽（無等級需求顯示「不限」）＋任務名＋NPC 名。就這三項，不放獎勵。
- **排序**：依 `lvmin`，無等級需求排最前。**沒有篩選框**。
- **分頁**：每頁 50 筆。分頁列中央顯示頁碼與**該頁等級區間**。
- **詳情面板**由上到下：標題列 → **系列鏈卡片** → 任務 NPC → 需求道具 → 獎勵。
- **系列鏈卡片**：置頂、可收合，標題列寫系列名與「第 N / M 步」；
  每個節點是一張小卡（編號圓徽＋任務名＋等級），目前這步用 accent 邊框＋底色。
  鏈用**前後關聯圖遍歷**建（不只靠 `parent`），`parent` 只當標題，沒有就用第一個任務名。
  鏈長度 1 時整張卡不顯示。
- **道具格子**：`h-14 w-12` 直式 = icon ＋ 下方置中的**名稱前兩字**標籤；
  數量徽章在**右上角**。hover 顯示道具彈窗，**零敘述文字**。
- **獎勵**：正數道具 icon ＋ 經驗／楓幣／名聲／技能 chip。負數道具不顯示。
- **點獎勵道具** → 彈窗列出「還有哪些任務給這個」（不離開目前任務）。
- **點 NPC 地圖** → 世界地圖彈窗（重用 `worldmap-view.tsx`）。查不到位置的 14 個顯示「劇情中出現」。
- **不做**：個人進度勾選、NPC 頭像、任務對話原文、任務摘要文字、等級篩選框。

## 已知取捨（是決定，不是待辦）

1. 卡片不顯示獎勵，但搜尋維度是獎勵 → 搜到後要逐筆點開確認。使用者明確選過兩次。
2. 按等級排序 + 分頁 → 想看特定等級要翻頁。用分頁列的等級區間標籤緩解。

## 路徑與命名

`/quests`，nav 加 `{ key: "quests", label: "任務查詢", icon: "📜", path: "quests" }`，排在「怪物掉落」後面。
未來會想要 `/quests/<id>` 獨立路由（Q17：先做右側面板，之後補），資料結構請預留。
