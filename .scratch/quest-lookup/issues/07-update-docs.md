# 07 — 更新 CLAUDE.md

Status: ready-for-agent
Blocked by: 06

在「資料管線」章節補進任務那條：

```
python tools/extract-quest.py       → reference-data/quest.json + npc-map.json
python tools/build-quest-data.py    → src/data/generated/quests.json
python tools/download-icons.py      （已擴充，一併抓任務道具）
```

並在「網站專案現況」加一段 `/quests` 的說明，寫法對齊現有的 `/monsters`、`/map` 段落。
把 `spec.md` 裡「已驗證的資料事實」的重點（QuestInfo 文字是空殼、QuestData 是 UTF-8、
npc→map 靠掃 705 張地圖的 life 節點、實裝判斷 296/28/166）濃縮進去，避免未來重新逆向。
