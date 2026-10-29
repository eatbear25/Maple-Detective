"""抓取官方活動（轉蛋、神秘商人）的機率表，存成快照。

用法：
    python tools/fetch-gacha-odds.py "https://maplestoryclassic-event.beanfun.com/EventAd/EventAd?eventAdId=19046"
    python tools/fetch-gacha-odds.py 19046
    python tools/fetch-gacha-odds.py 19046 --force   # 覆蓋已存在的快照

輸出 reference-data/gacha-history/<eventAdId>.json

⚠️ 這條管線跟本專案其他腳本不一樣：其他腳本從本機遊戲客戶端抽，隨時可重跑；
這支打的是線上 API，而該 API **只服務「當期還活著」的活動**（掃過 EventAdId
18900~19200，只有當期的 5 個有回應）。活動一過期，機率表全網再也撈不到，
所以必須在活動結束前跑。

活動頁本身是 Vue SPA，HTML 裡沒有資料，真資料在：
    GET /api/EventAd/GetDetail?EventADID=<id>
回傳 data.event[0]（標題/起訖）與 data.topics[]（topicContent 是 HTML 表格）。

兩種表格版面都吃得下：
- 轉蛋（19046）：一列一組「名稱｜機率」
- 神秘商人（20352）：一列三組「名稱｜機率｜名稱｜機率｜名稱｜機率」。官方的閱讀順序是
  **一欄一欄由上往下**（第一欄開頭那串跟遊戲內「本季特別商品」的排列一模一樣），
  所以存檔順序是先第一欄整欄、再第二欄、再第三欄，不是一列一列橫著讀。

神秘商人是常駐系統，API 的起訖填的是 1900~2100 這種佔位值，真正的當期期間寫在
機率說明的內文裡（「2026/10/29(四)維護後~2026/11/12(四)07:59」）。遇到佔位值就改讀內文。
"""

import argparse
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(PROJECT, "reference-data", "gacha-history")

API = "https://maplestoryclassic-event.beanfun.com/api/EventAd/GetDetail?EventADID={id}"
HEADERS = {
    "User-Agent": "maple-detective/1.0 (fan site odds archive)",
    "Content-Type": "application/json",
}

TW = timezone(timedelta(hours=8))


def parse_event_id(arg):
    """接受純數字或完整活動網址（query 參數大小寫不敏感）。"""
    if arg.isdigit():
        return int(arg)
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(arg).query)
    for key, values in qs.items():
        if key.lower() == "eventadid" and values and values[0].isdigit():
            return int(values[0])
    raise SystemExit(f"無法從 {arg!r} 解出 eventAdId（給純數字或完整活動網址）")


def fetch(event_id):
    req = urllib.request.Request(API.format(id=event_id), headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).replace(" ", " ").strip()


def parse_prizes(topic_content):
    """從機率說明的 HTML 表格解析出 [{name, rate}, ...]。

    每列可以有好幾組「名稱｜機率」，輸出順序是一欄一欄由上往下（見模組 docstring）。
    表頭那列（機率欄不是 N% 格式）會自然被跳過，不必假設它固定在第一列。
    """
    columns = []  # columns[k] = 第 k 組欄位由上往下的獎品
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", topic_content, re.S):
        cells = [strip_tags(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        for k in range(len(cells) // 2):
            name, rate = cells[2 * k], cells[2 * k + 1]
            m = re.fullmatch(r"([\d.]+)\s*%", rate)
            if not name or not m:
                continue
            while len(columns) <= k:
                columns.append([])
            columns[k].append({"name": name, "rate": float(m.group(1))})
    return [p for col in columns for p in col]


def is_placeholder(iso):
    """常駐活動的起訖是 1900-01-01 / 2100-12-31 這種佔位值。"""
    return not iso or not (2000 <= int(iso[:4]) <= 2090)


PERIOD_RE = re.compile(
    r"(\d{4})/(\d{1,2})/(\d{1,2})\([^)]*\)[^~～]*[~～]\s*"
    r"(\d{4})/(\d{1,2})/(\d{1,2})\([^)]*\)\s*(\d{1,2}):(\d{2})"
)


def parse_period(text):
    """從內文找「2026/10/29(四)維護後~2026/11/12(四)07:59」，回傳 (起, 訖, 原文)。

    起始只寫到「維護後」沒有時刻，所以只取日期。
    """
    m = PERIOD_RE.search(text)
    if not m:
        return None
    y1, m1, d1, y2, m2, d2, hh, mm = (int(x) for x in m.groups())
    start = f"{y1:04d}-{m1:02d}-{d1:02d}T00:00:00"
    end = f"{y2:04d}-{m2:02d}-{d2:02d}T{hh:02d}:{mm:02d}:00"
    return start, end, m.group(0)


def main():
    # Windows 終端機預設 cp950，印 ⚠️ 會直接 UnicodeEncodeError
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("event", help="活動網址或 eventAdId")
    ap.add_argument("--force", action="store_true", help="覆蓋已存在的快照")
    args = ap.parse_args()

    event_id = parse_event_id(args.event)
    dest = os.path.join(OUT_DIR, f"{event_id}.json")
    if os.path.exists(dest) and not args.force:
        print(f"已存在 {dest}，跳過（要重抓請加 --force）")
        return

    payload = fetch(event_id)
    data = payload.get("data") or {}
    events = data.get("event") or []
    topics = data.get("topics") or []
    if not events:
        raise SystemExit(f"eventAdId={event_id} 沒有活動資料（可能已過期或 ID 錯誤）")

    ev = events[0]
    odds_topic = next((t for t in topics if "機率" in (t.get("topicName") or "")), None)
    if odds_topic is None:
        found = [t.get("topicName") for t in topics]
        raise SystemExit(f"eventAdId={event_id} 找不到機率表，只有這些區塊：{found}")

    prizes = parse_prizes(odds_topic.get("topicContent") or "")
    if not prizes:
        raise SystemExit(f"eventAdId={event_id} 機率表解析出 0 筆，HTML 結構可能變了")

    total = round(sum(p["rate"] for p in prizes), 4)
    start, end, period_text = ev.get("startDate") or "", ev.get("endDate") or "", None
    if is_placeholder(start) or is_placeholder(end):
        found = parse_period(strip_tags(odds_topic.get("topicContent") or ""))
        if found is None:
            raise SystemExit(
                f"eventAdId={event_id} 的起訖是佔位值（{start} ~ {end}），內文也找不到期間，請人工檢查"
            )
        start, end, period_text = found
    snapshot = {
        "meta": {
            "eventAdId": event_id,
            "title": ev.get("mainTitle") or "",
            "startDate": start,
            "endDate": end,
            # 有值 = 起訖是從內文讀出來的（API 給的是佔位值）
            "periodText": period_text,
            "capturedAt": datetime.now(TW).strftime("%Y-%m-%d"),
            "source": API.format(id=event_id),
            "prizeCount": len(prizes),
            "rateTotal": total,
        },
        "prizes": prizes,
        # 原始回應一定要留：解析邏輯之後可能要改，但這份回應過期就再也拿不到了
        "raw": payload,
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=1)

    print(f"{ev.get('mainTitle')} | {start} ~ {end}")
    print(f"獎品 {len(prizes)} 筆，機率總和 {total}%")
    if abs(total - 100) > 1:
        print(f"⚠️  機率總和偏離 100% 達 {abs(total - 100):.2f} 個百分點，可能解析漏列，請人工核對")
    print(f"已寫入 {dest}")


if __name__ == "__main__":
    main()
