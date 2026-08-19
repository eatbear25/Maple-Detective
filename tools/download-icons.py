"""從 maplestory.io 下載掉落查詢會用到的圖示到 public/icons/。

用法：python tools/download-icons.py
已存在的檔案會跳過，可重複執行。來源優先 TMS/209，404 時退回 GMS/62。
- 道具：public/icons/item/{itemId}.png
- 怪物：public/icons/mob/{mobId}.gif（站立動圖）
"""

import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(PROJECT, "public", "icons")
SOURCES = ["TMS/209", "GMS/62"]
HEADERS = {"User-Agent": "maple-detective/1.0 (fan site asset fetch)"}


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


# 掉落表以外、頁面自己要用的道具圖示（掉落資料裡不會出現，得手動列）。
# 4001095–4001100：月妙的年糕第一階段的六色迎月花種子。
EXTRA_ITEMS = [4001095, 4001096, 4001097, 4001098, 4001099, 4001100]

MOB_STANCES = ["stand", "fly", "move"]  # 部分怪物（如純飛行怪）沒有 stand 動畫，依序退回


def download(kind, oid, path_tpl, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return None
    stances = MOB_STANCES if kind == "mob" else [None]
    for src in SOURCES:
        for stance in stances:
            tpl = path_tpl.format(id=oid, stance=stance) if stance else path_tpl.format(id=oid)
            try:
                data = fetch(f"https://maplestory.io/api/{src}/{tpl}")
                if data:
                    with open(dest, "wb") as f:
                        f.write(data)
                    return None
            except Exception:
                continue
    return (kind, oid)


def main():
    with open(os.path.join(PROJECT, "reference-data", "monster-book.json"), encoding="utf-8") as f:
        mobs = json.load(f)["mobs"]
    sup_path = os.path.join(PROJECT, "reference-data", "drop-supplement.json")
    sup_items = set()
    if os.path.exists(sup_path):
        with open(sup_path, encoding="utf-8") as f:
            sup_items = {i for k, v in json.load(f).items() if not k.startswith("_") for i in v}

    os.makedirs(os.path.join(PUB, "item"), exist_ok=True)
    os.makedirs(os.path.join(PUB, "mob"), exist_ok=True)

    jobs = []
    for mob_id in mobs:
        jobs.append(("mob", mob_id, "mob/{id}/render/{stance}", os.path.join(PUB, "mob", f"{mob_id}.gif")))
    for item_id in sorted({i for v in mobs.values() for i in v["rewards"]} | sup_items | set(EXTRA_ITEMS)):
        jobs.append(("item", item_id, "item/{id}/icon", os.path.join(PUB, "item", f"{item_id}.png")))

    print(f"{len(jobs)} 個圖示要抓")
    with ThreadPoolExecutor(max_workers=8) as ex:
        misses = [m for m in ex.map(lambda j: download(*j), jobs) if m]

    print(f"完成，失敗 {len(misses)} 個")
    for kind, oid in misses:
        print(f"  MISS {kind} {oid}")


if __name__ == "__main__":
    main()
