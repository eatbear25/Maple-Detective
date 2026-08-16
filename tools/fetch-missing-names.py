"""補齊客戶端名稱表缺少的 mob / item 中文名（來源：maplestory.io TMS 資料）。

用法：python tools/fetch-missing-names.py
輸出 reference-data/name-supplement.json：{ "items": {id: name}, "mobs": {id: name} }
tools/build-site-data.py 會自動合併這份補充表。
"""

import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")
OUT = os.path.join(REF, "name-supplement.json")
SOURCES = ["TMS/209", "GMS/62"]


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "maple-detective/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def fetch_name(kind, oid):
    for src in SOURCES:
        try:
            data = get_json(f"https://maplestory.io/api/{src}/{kind}/{oid}")
            name = data.get("name") if kind == "mob" else (data.get("description") or {}).get("name")
            if name:
                return kind, str(oid), name
        except Exception:
            continue
    return kind, str(oid), None


def main():
    with open(os.path.join(REF, "monster-book.json"), encoding="utf-8") as f:
        book = json.load(f)["mobs"]
    with open(os.path.join(REF, "name-tables", "Item.json"), encoding="utf-8") as f:
        item_names = json.load(f)
    with open(os.path.join(REF, "name-tables", "Mob.json"), encoding="utf-8") as f:
        mob_names = json.load(f)

    reward_ids = {str(i) for v in book.values() for i in v["rewards"]}
    missing_items = sorted(i for i in reward_ids if i not in item_names)
    missing_mobs = sorted(m for m in book if m not in mob_names)
    print(f"缺名稱：道具 {len(missing_items)}、怪物 {len(missing_mobs)}")

    jobs = [("item", i) for i in missing_items] + [("mob", m) for m in missing_mobs]
    out = {"items": {}, "mobs": {}}
    with ThreadPoolExecutor(max_workers=8) as ex:
        for kind, oid, name in ex.map(lambda j: fetch_name(*j), jobs):
            if name:
                out["items" if kind == "item" else "mobs"][oid] = name

    print(f"補到：道具 {len(out['items'])}、怪物 {len(out['mobs'])}")
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=True)
    print("已寫入", OUT)


if __name__ == "__main__":
    main()
