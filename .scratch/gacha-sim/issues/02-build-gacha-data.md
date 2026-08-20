# 02 — tools/build-gacha-data.py

Status: done（2026-08-20 實作完成）
Blocked by: 01

Join 出網站用的 `src/data/generated/gacha.json`。
獨立腳本，不要塞進 `build-site-data.py`（跟 `build-fashion-data.py`、`build-quest-data.py` 同慣例）。

## 輸入

- `reference-data/gacha-history/*.json`（全部期數）
- `reference-data/name-tables/Item.json`（名稱 → ID 反查）
- `reference-data/commodity-history/<最新>.json`（轉蛋券價格）

## 輸出

`src/data/generated/gacha.json`

```jsonc
{
  "pools": [{
    "eventAdId": 19046,
    "title": "轉蛋機",
    "startDate": "...", "endDate": "...",
    "capturedAt": "2026-08-20",
    "ticket": { "itemId": 5222222, "single": 20, "bundle10": 180 },
    "prizes": [
      { "itemId": 3010423, "name": "蘑菇友情椅子", "rate": 1.00, "tier": "chair" }
    ],
    "goals": [ { "id": "mystery", "label": "神秘任務", "reward": null, "groups": [...] } ]
  }]
}
```

## 名稱 → itemId 消歧（**31 筆會撞**）

101 筆全部在 `Item.json` 查得到，但 31 筆同名多 ID。規則依序套用：

1. 若只有一個 ID → 直接用
2. 多個 ID → 優先取通過「已實裝判斷」的那個（比照 `build-site-data.py` 既有邏輯）
3. 仍多於一個 → 取**較小 / 原始號段**的 ID
4. 每一筆消歧都要在 stdout 印出 `名稱 → 選了 X（候選 X,Y）`，人工可覆核

已知案例：`單手劍攻擊卷軸100%` → 2043000 / 2043036；`玫瑰椅` → 3010130 / 3019859。
如果自動規則選錯，開一個 `reference-data/gacha-id-overrides.json` 手動覆寫，**不要改死在程式裡**。

## 稀有度分層 `tier`

依機率值分組（**這是分類不是計算**，Q17 砍掉的是機率預測，不是分類）：

| rate | tier |
|---|---|
| 1.48 | `emote` 表情特效券（43） |
| 1.00 | `chair` 椅子（4） |
| 0.94 | `bag` 黑之包（1） |
| 0.90 | `morph` 變身藥水/雕像（11） |
| 0.67 | `reset` 重配卷軸券（3） |
| 0.58 | `scroll` 100% 卷軸（27） |
| 0.50 | `slot` 擴充券/瞬移之石（5） |
| 0.35 | `rare` 橡皮擦與任務道具（8） |

數量對不上要報錯——那代表官方換了獎池，需要人看。

## 內建目標 `goals`

神秘任務寫死一筆：

```jsonc
{
  "id": "mystery",
  "label": "神秘任務",
  "reward": null,          // Q25=B 決定不挖 Quest 包，前端顯示「未公開」
  "groups": [
    { "any": [4001009], "count": 1 },   // 木妖橡皮擦
    { "any": [4001010], "count": 1 },   // 蘑菇王橡皮擦
    { "any": [4001011], "count": 1 },   // 猴子橡皮擦
    { "any": [4001012], "count": 1 },   // 大幽靈橡皮擦
    { "any": [4001013], "count": 1 },   // 綠水靈橡皮擦
    { "any": [4001014], "count": 1 },   // 三眼章魚橡皮擦
    { "any": [4001116, 4001115], "count": 1 }  // 六角水晶項鍊 OR 水女神的衣料
  ]
}
```

`groups` 就是 `AND of OR-groups` 的資料模型——**自訂目標共用同一個結構**，
只是 UI 產出的每個 group 都只有一個元素（Q12=A：UI 不暴露 OR）。

## 驗收

- 19046 產出 101 筆 prizes，`rate` 總和 99.97
- 每筆 prize 都有非 null 的 `itemId`
- 消歧報告完整印出 31 筆
