# 01 — tools/extract-quest.py

Status: ready-for-agent

從客戶端抽任務原始資料，輸出兩份 `reference-data/` 檔案。**用 container path 掃描定位 bundle，不要寫死 hash 檔名。**

## 輸出

1. `reference-data/quest.json`
   - `QuestInfo` / `Check` / `Act` 三棵樹（`Say` 不要）
   - `String/TW/QuestData.json` 的中文名 + `Info.parent` + 說明
2. `reference-data/npc-map.json` — `{ "<npcId>": ["<mapId>", ...] }`
   - 掃 `Map/` 包裡數字命名的 `.wzjson`（705 張），讀 `life` 節點中 `type == "n"` 的 `id`
   - 這份對未來的 NPC 查詢工具也有用，是一等公民不是中間檔

## 注意

- `QuestData.json` 是 **UTF-8**：`p.read().m_Script.encode('utf-8','surrogateescape').decode('utf-8')`
- `QuestInfo` 的字串值是空殼佔位符，**不要拿它的 `name`/`parent`**
- 讀 raw bytes 要走 `env.objects` 的 `reader.get_raw_data()`（照 `extract-monster-book.py` 的寫法），
  直接 `pptr.read()` 會炸 typetree
- 加 docstring 說明格式與定位技巧，遊戲更新後直接重跑
