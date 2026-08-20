# 09 — nav 註冊、驗收、更新 CLAUDE.md

Status: done（2026-08-20 實作完成）
Blocked by: 08

## nav

`src/nav.ts` 加：

```ts
{ key: "gacha", label: "轉蛋模擬", icon: "🎰", path: "gacha", enabled: true }
```

排在 `monsters`（怪物掉落）後面。

## 驗收清單

- [ ] 手機等比縮放，遊戲視窗不破版、三顆按鈕可點（Q26=A）
- [ ] 自動模式快轉播放 3~5 秒、可中途喊停（Q10=B）
- [ ] 預算上限預設帶 NT$3,000，燒完會停並出結算畫面（Q19=C）
- [ ] 10,000 抽煞車有作用
- [ ] 機率表 101 筆全有 icon（抓不到的顯示 `#id`）
- [ ] 重整頁面歸零（純 session，Q8=A）
- [ ] 頁面**沒有任何**期望值/分佈/百分位字樣（Q17=A）

## 更新 CLAUDE.md

在「資料管線」章節補一條：

```
python tools/fetch-gacha-odds.py    → reference-data/gacha-history/<eventAdId>.json
python tools/build-gacha-data.py    → src/data/generated/gacha.json
python tools/download-icons.py      （已擴充，一併抓轉蛋道具與轉蛋機 sprite）
```

**並且要寫明這條管線跟其他的不一樣**：其他腳本是從本機遊戲客戶端抽，隨時可重跑；
這條是打線上 API，**活動過期後永遠抓不到**，必須在活動結束前跑。

在「網站專案現況」加一段 `/gacha` 說明，寫法對齊現有的 `/monsters`、`/map` 段落。
把 spec 裡「已驗證的資料事實」的重點濃縮進去：

- 機率表在 `GET /api/EventAd/GetDetail?EventADID=<id>`，只服務當期活動
- 19046 = 101 筆 / 99.97%，7 個機率階層
- 轉蛋券 5222222，20 點/張、180 點/10 張，樂豆點 1:1 NT$
- 轉蛋機 sprite 走 maplestory.io NPC 端點（9110011），對話框是 CSS 仿製、**沒有挖 atlas**
- 明確記錄「**不做機率計算**」是決定不是待辦，避免未來的 agent 熱心加回來
