# 03 — 擴充 tools/download-icons.py

Status: ready-for-agent
Blocked by: 02

目前 `main()` 只讀 `reference-data/monster-book.json`。要一併讀 `src/data/generated/quests.json`（或
`reference-data/quest.json`），把任務的 `need` + `rewards` 道具 id 併進 item 抓取清單。

已存在會跳過，可重複執行。sample 用到的 36 種已經抓過了，正式版預期還要補約 300 種。
