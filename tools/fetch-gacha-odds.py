"""抓取轉蛋活動的官方機率表，存成快照。

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
    """從機率說明的 HTML 表格解析出 [(名稱, 機率float), ...]。

    表頭那列（機率欄不是 N% 格式）會自然被跳過，不必假設它固定在第一列。
    """
    prizes = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", topic_content, re.S):
        cells = [strip_tags(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if len(cells) < 2:
            continue
        name, rate = cells[0], cells[1]
        m = re.fullmatch(r"([\d.]+)\s*%", rate)
        if not name or not m:
            continue
        prizes.append({"name": name, "rate": float(m.group(1))})
    return prizes


def main():
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
    snapshot = {
        "meta": {
            "eventAdId": event_id,
            "title": ev.get("mainTitle") or "",
            "startDate": ev.get("startDate") or "",
            "endDate": ev.get("endDate") or "",
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

    print(f"{ev.get('mainTitle')} | {ev.get('startDate')} ~ {ev.get('endDate')}")
    print(f"獎品 {len(prizes)} 筆，機率總和 {total}%")
    if abs(total - 100) > 1:
        print(f"⚠️  機率總和偏離 100% 達 {abs(total - 100):.2f} 個百分點，可能解析漏列，請人工核對")
    print(f"已寫入 {dest}")


if __name__ == "__main__":
    main()
