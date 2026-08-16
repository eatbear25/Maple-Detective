"""用 maplestory.io 補客戶端 Map.json 缺的地圖名稱（未實裝地圖用）。

用法：python tools/fetch-map-names.py
輸出 reference-data/map-supplement.json：{ mapId: { "street", "name" } }
查詢範圍＝「掉落資料用到的地圖 ∪ 世界地圖點位上的地圖（worldmap.json，
地圖導覽功能要顯示全部點點）」中客戶端 Map.json 沒名字的；已在輸出檔裡的
會跳過，可重複執行。來源優先 TMS/209（中文），404 再試 GMS/62（英文墊底）。
"""

import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")
OUT = os.path.join(REF, "map-supplement.json")
SOURCES = ["TMS/209", "GMS/62"]
HEADERS = {"User-Agent": "maple-detective/1.0 (fan site data fetch)"}


def fetch_name(map_id):
    for src in SOURCES:
        try:
            req = urllib.request.Request(
                f"https://maplestory.io/api/{src}/map/{map_id}/name", headers=HEADERS
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.load(r)
            name = (data.get("name") or "").strip()
            street = (data.get("streetName") or "").strip()
            if name or street:
                return map_id, {"street": street, "name": name}
        except Exception:
            continue
    return map_id, None


def main():
    with open(os.path.join(REF, "monster-book.json"), encoding="utf-8") as f:
        book = json.load(f)["mobs"]
    with open(os.path.join(REF, "name-tables", "Map.json"), encoding="utf-8") as f:
        client_maps = json.load(f)
    done = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            done = json.load(f)

    used = {m for e in book.values() for m in e["maps"]}
    wm_path = os.path.join(REF, "worldmap.json")
    if os.path.exists(wm_path):
        with open(wm_path, encoding="utf-8") as f:
            sheets = json.load(f)["sheets"]
        used |= {m for s in sheets.values() for sp in s["spots"] for m in sp["maps"]}
    used = sorted(used)
    todo = [
        m for m in used
        if str(m) not in done
        and not (client_maps.get(str(m)) or {}).get("mapName")
    ]
    print(f"用到 {len(used)} 張地圖，客戶端沒名字且未查過 {len(todo)} 張")

    with ThreadPoolExecutor(max_workers=8) as ex:
        for map_id, entry in ex.map(fetch_name, todo):
            if entry:
                done[str(map_id)] = entry

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(done, f, ensure_ascii=False, indent=1)
    misses = [m for m in todo if str(m) not in done]
    print(f"已寫入 {OUT}（{len(done)} 筆；查無名稱 {len(misses)} 張：{misses[:10]}）")


if __name__ == "__main__":
    main()
