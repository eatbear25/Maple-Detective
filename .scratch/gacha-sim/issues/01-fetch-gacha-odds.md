# 01 — tools/fetch-gacha-odds.py

Status: done（2026-08-20 實作完成）

## ⚠️ 時效

**活動過期後機率表永久消失。** 來源 API 只服務「當期還活著」的活動，
掃過 EventAdId 18900~19200 只有當期的 5 個有回應。

19046（2026-08-20 這期）的原始回應已手動存在 `.scratch/gacha-sim/raw-19046.json` 當保險。

## 做什麼

**使用者給活動網址，腳本抓回來存快照。**（原本規劃的自動掃描 ID 範圍已取消。）

```
python tools/fetch-gacha-odds.py "https://maplestoryclassic-event.beanfun.com/EventAd/EventAd?eventAdId=19046"
python tools/fetch-gacha-odds.py 19046      # 也接受純數字
```

活動頁是 Vue SPA，真資料在：

```
GET https://maplestoryclassic-event.beanfun.com/api/EventAd/GetDetail?EventADID=<id>
```

從網址參數解出 `eventAdId`（大小寫不敏感），打 API 取回 JSON。

## 輸出

`reference-data/gacha-history/<eventAdId>.json`

```jsonc
{
  "meta": {
    "eventAdId": 19046,
    "title": "轉蛋機",
    "startDate": "2026-08-20T09:00:00",
    "endDate": "2026-09-10T00:00:00",
    "capturedAt": "2026-08-20",
    "source": "https://.../api/EventAd/GetDetail?EventADID=19046"
  },
  "prizes": [ { "name": "蘑菇友情椅子", "rate": 1.00 }, ... ],
  "raw": { ...原始 API 回應全文... }
}
```

- `prizes` 從 `topics[]` 裡 `topicName` 含「機率」那筆的 `topicContent` HTML 表格解析：
  抓 `<tr>`，每列兩個 `<td>`（名稱／機率），跳過表頭，機率去 `%` 轉 float。
- **`raw` 一定要留**：解析邏輯之後可能要改，但原始回應過期就再也拿不到了。

## 驗收

- 已存在的檔案**不覆蓋**（除非 `--force`），可重複執行
- 跑完印出：標題、期間、幾筆獎品、機率總和。19046 應為 **101 筆 / 99.97%**
- 機率總和偏離 100% 超過 1 個百分點要印警告（可能解析漏列）
- 找不到機率表要明確報錯，不要靜默產出空檔
